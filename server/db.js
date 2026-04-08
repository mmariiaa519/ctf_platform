/**
 * @module db
 * @description
 * Flat-file JSON database layer for the MARSEC CTF platform.
 *
 * Instead of a traditional DBMS (MongoDB, PostgreSQL, etc.) this module
 * persists all platform state as plain JSON files inside a `data/` directory.
 * This keeps the deployment zero-dependency on external services — the only
 * requirement is a writable filesystem.
 *
 * ── Design highlights ──────────────────────────────────────────────────────
 *  1. **Portable DATA_DIR resolution** — works both inside the Docker
 *     container (`/app/data`) and in local development (`../data` relative
 *     to `server/`).
 *  2. **Backup-on-save** — every `save()` call creates a `.bak` snapshot
 *     of the previous version *before* writing, so a crash mid-write never
 *     loses the last-known-good state.
 *  3. **Atomic writes** — data is first flushed to a `.tmp` file, then
 *     renamed over the target.  `rename` is atomic on most filesystems, so
 *     a power-cut during the write leaves either the old file or the new
 *     one intact — never a half-written file.
 *  4. **Hot-reload** — `reload(collection)` re-reads a single JSON file
 *     from disk without restarting the process.  Used primarily for
 *     `admins.json` so new admin credentials take effect immediately.
 * ────────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');

// ── DATA_DIR resolution ─────────────────────────────────────────────────────
// The data directory location depends on the runtime environment:
//
//  • Docker (production):  The Dockerfile copies everything under `/app/`,
//    so `data/` lives at `/app/data` — a sibling of the server files.
//    In this case `path.join(__dirname, 'data')` resolves correctly.
//
//  • Local development:    The repo root contains `data/` and `server/` as
//    siblings, so from `server/` we need to go one level up (`../data`).
//
//  • Override:             Setting the `DATA_DIR` environment variable
//    bypasses auto-detection entirely — useful for CI or custom layouts.
//
// The ternary checks which of the two conventional locations actually exists
// on disk so the code works in both contexts without configuration.
// ────────────────────────────────────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || (
  fs.existsSync(path.join(__dirname, 'data'))
    ? path.join(__dirname, 'data')
    : path.join(__dirname, '..', 'data')
);

// Ensure the data directory exists (recursive: true handles nested paths).
// This is a safety net for first-run scenarios (fresh clone, empty Docker volume).
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── File path registry ──────────────────────────────────────────────────────
// Central map of collection names → absolute file paths.
// Every function in this module resolves files through this object, so
// adding a new collection is a single-line change here.
// ────────────────────────────────────────────────────────────────────────────
const paths = {
  teams:       path.join(DATA_DIR, 'teams.json'),
  challenges:  path.join(DATA_DIR, 'challenges.json'),
  submissions: path.join(DATA_DIR, 'submissions.json'),
  hintUnlocks: path.join(DATA_DIR, 'hint_unlocks.json'),
  admins:      path.join(DATA_DIR, 'admins.json'),
};

// ── load() ──────────────────────────────────────────────────────────────────

/**
 * Reads and parses a single JSON data file from disk.
 *
 * Implements a two-tier recovery strategy:
 *  1. Try to read the primary file.
 *  2. If parsing fails (corrupted JSON, encoding issue, etc.), fall back to
 *     the `.bak` backup created by the last successful `save()`.
 *  3. If both are unusable, return an empty array so the application can
 *     continue operating (new data will be written on the next `save()`).
 *
 * @param {string} filePath - Absolute path to the JSON file to load.
 * @returns {Array|Object} Parsed contents, or `[]` if the file is missing
 *                         or unrecoverable.
 */
function load(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    // Primary file is corrupt or unreadable — log and attempt backup recovery.
    console.error(`[DB] Error loading ${path.basename(filePath)}:`, err.message);

    const backup = filePath + '.bak';
    if (fs.existsSync(backup)) {
      try {
        console.warn(`[DB] Recovering from backup: ${path.basename(backup)}`);
        return JSON.parse(fs.readFileSync(backup, 'utf-8'));
      } catch { /* backup also corrupt, fall through to empty default */ }
    }
  }
  // No file on disk or all recovery attempts failed — start with empty data.
  return [];
}

// ── save() ──────────────────────────────────────────────────────────────────

/**
 * Persists an in-memory collection to its JSON file on disk.
 *
 * Write strategy (backup + atomic rename):
 *  1. **Backup** — Copy the current file to `<file>.bak`.  If the upcoming
 *     write fails or the process crashes, `load()` can fall back to this
 *     snapshot on the next startup.
 *  2. **Write to temp** — Serialize the data and flush it to `<file>.tmp`.
 *     This is a brand-new file, so a crash here only leaves an orphaned
 *     `.tmp` file — the real file remains untouched.
 *  3. **Atomic rename** — `fs.renameSync` replaces the target path in a
 *     single filesystem operation.  On POSIX systems this is guaranteed
 *     atomic; on Windows/NTFS it is atomic within the same volume.
 *     The result: readers always see either the *old* complete file or
 *     the *new* complete file — never a partially-written one.
 *
 * @param {string} collection - Key in the `paths` registry (e.g. 'teams',
 *                              'challenges', 'submissions').
 * @throws {Error} If `collection` is not a recognized key, or if the
 *                 filesystem write ultimately fails.
 */
function save(collection) {
  const filePath = paths[collection];
  if (!filePath) throw new Error(`Unknown collection: ${collection}`);
  try {
    // Step 1: backup the current version (only if the file already exists).
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, filePath + '.bak');
    }
    // Step 2: write to a temporary file first (avoids corrupting the real file on crash).
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db[collection], null, 2));
    // Step 3: atomic rename — swaps the old file for the new one in one operation.
    fs.renameSync(tmp, filePath);
  } catch (err) {
    console.error(`[DB] Error saving ${collection}:`, err.message);
    throw err; // Re-throw so the calling route can return a 500 to the client.
  }
}

// ── In-memory database object ───────────────────────────────────────────────
// All collections are loaded into RAM at startup.  Route handlers read/write
// this object directly, then call `save(collection)` to flush changes.
// This gives O(1) reads with no I/O overhead during normal request handling.
// ────────────────────────────────────────────────────────────────────────────
const db = {
  teams:       load(paths.teams),
  challenges:  load(paths.challenges),
  submissions: load(paths.submissions),
  hintUnlocks: load(paths.hintUnlocks),
  admins:      load(paths.admins),
};

// ── reload() ────────────────────────────────────────────────────────────────

/**
 * Hot-reloads a single collection from disk into the in-memory `db` object
 * without restarting the server process.
 *
 * Primary use case: the admin updates `admins.json` on the host (or inside
 * the Docker volume) and wants the change to take effect immediately.
 * Calling `reload('admins')` re-reads the file so new credentials are
 * recognized on the next login attempt.
 *
 * @param {string} collection - Key in the `paths` registry to reload.
 */
function reload(collection) {
  if (paths[collection]) {
    db[collection] = load(paths[collection]);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────
// • db     — the live in-memory store; route handlers import and mutate this.
// • save   — flush a named collection to disk (with backup + atomic write).
// • reload — re-read a collection from disk (hot-reload without restart).
// ────────────────────────────────────────────────────────────────────────────
module.exports = { db, save, reload };
