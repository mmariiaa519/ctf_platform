const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// ─── Configuration ──────────────────────────────────────────────
const FLAG_SALT = process.env.FLAG_SALT || 'marsec-cyber-range-2026-salt';
const PORT = process.env.PORT || 3000;
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 10;

// ─── Crypto helpers ─────────────────────────────────────────────
const hashFlag = (flag) => {
  return crypto.createHash('sha256').update(FLAG_SALT + flag.trim()).digest('hex');
};

const verifyFlag = (submitted, storedHash) => {
  const hash = hashFlag(submitted);
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
  } catch {
    return false;
  }
};

// ─── Rate limiting ──────────────────────────────────────────────
const rateLimitMap = new Map();

const checkRateLimit = (teamId) => {
  const now = Date.now();
  const attempts = (rateLimitMap.get(teamId) || []).filter(t => now - t < RATE_LIMIT_WINDOW);

  if (attempts.length >= RATE_LIMIT_MAX) return false;

  attempts.push(now);
  rateLimitMap.set(teamId, attempts);
  return true;
};

// ─── Database ───────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'data');
if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });

const dbFiles = {
  teams: path.join(DB_PATH, 'teams.json'),
  challenges: path.join(DB_PATH, 'challenges.json'),
  submissions: path.join(DB_PATH, 'submissions.json'),
  hintUnlocks: path.join(DB_PATH, 'hint_unlocks.json'),
  admins: path.join(DB_PATH, 'admins.json'),
};

const loadDB = (file) => {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    console.error(`Error loading ${file}:`, e.message);
  }
  return [];
};

const saveDB = (file, data) => {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`Error saving ${file}:`, e.message);
  }
};

const db = {
  teams: loadDB(dbFiles.teams),
  challenges: loadDB(dbFiles.challenges),
  submissions: loadDB(dbFiles.submissions),
  hintUnlocks: loadDB(dbFiles.hintUnlocks),
  admins: loadDB(dbFiles.admins),
};

// ─── Default admin ──────────────────────────────────────────────
if (!db.admins.find(a => a.username === 'admin')) {
  db.admins.push({
    id: uuidv4(),
    username: 'admin',
    password: bcrypt.hashSync('CTF@dm1n!2026$SecurePwd', 10),
  });
  saveDB(dbFiles.admins, db.admins);
  console.log('[MARSEC] Default admin created');
}

// ─── Points calculation ─────────────────────────────────────────
const HINT_MULTIPLIERS = [1, 0.75, 0.5, 0.3];
const calculatePoints = (base, hints) => {
  return Math.floor(base * HINT_MULTIPLIERS[Math.min(hints, 3)]);
};

// ─── Express app ────────────────────────────────────────────────
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'marsec-session-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
}));

// ─── Auth middleware ────────────────────────────────────────────
const requireAuth = (req, res, next) => {
  if (!req.session.teamId) return res.status(401).json({ error: 'Sesión no válida' });
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Acceso denegado' });
  next();
};

// ═══════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════

// Register team
app.post('/api/register', (req, res) => {
  const { name, password } = req.body;

  if (!name || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
  }

  const trimmed = name.trim();

  if (trimmed.length < 3 || trimmed.length > 30) {
    return res.status(400).json({ error: 'El nombre debe tener entre 3 y 30 caracteres' });
  }

  if (!/^[a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _\-]+$/.test(trimmed)) {
    return res.status(400).json({ error: 'El nombre solo puede contener letras, números, espacios y guiones' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  }

  if (db.teams.find(t => t.name.toLowerCase() === trimmed.toLowerCase())) {
    return res.status(409).json({ error: 'El nombre de equipo ya existe' });
  }

  const team = {
    id: uuidv4(),
    name: trimmed,
    password: bcrypt.hashSync(password, 10),
    created_at: new Date().toISOString(),
  };

  db.teams.push(team);
  saveDB(dbFiles.teams, db.teams);

  req.session.teamId = team.id;
  req.session.teamName = team.name;

  res.json({ success: true, teamName: team.name, teamId: team.id });
});

// Login team
app.post('/api/login', (req, res) => {
  const { name, password } = req.body;

  if (!name || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
  }

  const team = db.teams.find(t => t.name.toLowerCase() === name.trim().toLowerCase());
  if (!team || !bcrypt.compareSync(password, team.password)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  req.session.teamId = team.id;
  req.session.teamName = team.name;

  res.json({ success: true, teamName: team.name, teamId: team.id });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Current session
app.get('/api/me', (req, res) => {
  if (!req.session.teamId) {
    return res.json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    teamId: req.session.teamId,
    teamName: req.session.teamName,
    isAdmin: req.session.isAdmin || false,
  });
});

// Get challenges (public, no flags)
app.get('/api/challenges', (req, res) => {
  const challenges = [...db.challenges].sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0));

  const solvedMap = {};
  const hintsMap = {};

  if (req.session.teamId) {
    db.submissions
      .filter(s => s.team_id === req.session.teamId)
      .forEach(s => { solvedMap[s.challenge_id] = s.hints_used; });

    db.hintUnlocks
      .filter(h => h.team_id === req.session.teamId)
      .forEach(h => {
        if (!hintsMap[h.challenge_id]) hintsMap[h.challenge_id] = [];
        hintsMap[h.challenge_id].push(h.hint_number);
      });
  }

  const result = challenges.map(c => ({
    id: c.id,
    title: c.title,
    description: c.description,
    category: c.category,
    points: c.points,
    order_num: c.order_num,
    solved: c.id in solvedMap,
    hintsUsed: solvedMap[c.id] || 0,
    unlockedHints: hintsMap[c.id] || [],
    hint1: hintsMap[c.id]?.includes(1) ? c.hint1 : null,
    hint2: hintsMap[c.id]?.includes(2) ? c.hint2 : null,
    hint3: hintsMap[c.id]?.includes(3) ? c.hint3 : null,
  }));

  res.json(result);
});

// Submit flag
app.post('/api/submit', requireAuth, (req, res) => {
  const { challengeId, flag } = req.body;

  if (!challengeId || !flag) {
    return res.status(400).json({ error: 'Challenge ID y flag requeridos' });
  }

  if (!checkRateLimit(req.session.teamId)) {
    return res.status(429).json({
      error: 'Demasiados intentos. Espera un minuto.',
      rateLimited: true,
    });
  }

  if (db.submissions.find(s => s.team_id === req.session.teamId && s.challenge_id === challengeId)) {
    return res.status(400).json({ error: 'Ya has resuelto este reto' });
  }

  const challenge = db.challenges.find(c => c.id === challengeId);
  if (!challenge) {
    return res.status(404).json({ error: 'Reto no encontrado' });
  }

  let isCorrect = false;
  if (challenge.flagHash) {
    isCorrect = verifyFlag(flag, challenge.flagHash);
  } else if (challenge.flag) {
    isCorrect = flag.trim() === challenge.flag;
  }

  if (!isCorrect) {
    return res.json({ correct: false, message: 'Flag incorrecta' });
  }

  const hintsUsed = db.hintUnlocks.filter(
    h => h.team_id === req.session.teamId && h.challenge_id === challengeId
  ).length;

  const pointsAwarded = calculatePoints(challenge.points, hintsUsed);

  db.submissions.push({
    id: uuidv4(),
    team_id: req.session.teamId,
    challenge_id: challengeId,
    points_awarded: pointsAwarded,
    hints_used: hintsUsed,
    submitted_at: new Date().toISOString(),
  });
  saveDB(dbFiles.submissions, db.submissions);

  res.json({ correct: true, message: '¡Flag correcta!', pointsAwarded, hintsUsed });
});

// Unlock hint
app.post('/api/hint', requireAuth, (req, res) => {
  const { challengeId, hintNumber } = req.body;

  if (!challengeId || !hintNumber || hintNumber < 1 || hintNumber > 3) {
    return res.status(400).json({ error: 'Parámetros inválidos' });
  }

  if (db.submissions.find(s => s.team_id === req.session.teamId && s.challenge_id === challengeId)) {
    return res.status(400).json({ error: 'Ya has resuelto este reto' });
  }

  if (db.hintUnlocks.find(h =>
    h.team_id === req.session.teamId &&
    h.challenge_id === challengeId &&
    h.hint_number === hintNumber
  )) {
    return res.status(400).json({ error: 'Pista ya desbloqueada' });
  }

  if (hintNumber > 1) {
    const prev = db.hintUnlocks.find(h =>
      h.team_id === req.session.teamId &&
      h.challenge_id === challengeId &&
      h.hint_number === hintNumber - 1
    );
    if (!prev) {
      return res.status(400).json({ error: 'Desbloquea las pistas anteriores primero' });
    }
  }

  const challenge = db.challenges.find(c => c.id === challengeId);
  if (!challenge) return res.status(404).json({ error: 'Reto no encontrado' });

  const hintText = challenge[`hint${hintNumber}`];
  if (!hintText) return res.status(400).json({ error: 'Pista no disponible' });

  db.hintUnlocks.push({
    id: uuidv4(),
    team_id: req.session.teamId,
    challenge_id: challengeId,
    hint_number: hintNumber,
    unlocked_at: new Date().toISOString(),
  });
  saveDB(dbFiles.hintUnlocks, db.hintUnlocks);

  const totalHints = hintNumber;
  res.json({
    success: true,
    hint: hintText,
    newMaxPoints: calculatePoints(challenge.points, totalHints),
    hintsUsed: totalHints,
  });
});

// Scoreboard
app.get('/api/scoreboard', (req, res) => {
  const scores = db.teams.map(team => {
    const subs = db.submissions.filter(s => s.team_id === team.id);
    const totalPoints = subs.reduce((sum, s) => sum + s.points_awarded, 0);
    const lastSolve = subs.length > 0
      ? subs.reduce((latest, s) => s.submitted_at > latest ? s.submitted_at : latest, '')
      : null;

    return {
      id: team.id,
      name: team.name,
      joined: team.created_at,
      total_points: totalPoints,
      challenges_solved: subs.length,
      last_solve: lastSolve,
    };
  });

  scores.sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    if (!a.last_solve) return 1;
    if (!b.last_solve) return -1;
    return new Date(a.last_solve) - new Date(b.last_solve);
  });

  scores.forEach((t, i) => { t.rank = i + 1; });

  res.json(scores);
});

// Submission history
app.get('/api/submissions/:teamId', (req, res) => {
  const subs = db.submissions
    .filter(s => s.team_id === req.params.teamId)
    .map(s => {
      const ch = db.challenges.find(c => c.id === s.challenge_id);
      return {
        submitted_at: s.submitted_at,
        points_awarded: s.points_awarded,
        hints_used: s.hints_used,
        challenge_title: ch?.title || 'Desconocido',
        category: ch?.category || 'Desconocido',
        base_points: ch?.points || 0,
      };
    })
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

  res.json(subs);
});

// ═══════════════════════════════════════════════════════════════
//  ADMIN API
// ═══════════════════════════════════════════════════════════════

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.admins.find(a => a.username === username);

  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  req.session.isAdmin = true;
  req.session.adminId = admin.id;
  req.session.teamName = 'Admin';
  req.session.teamId = 'admin';

  res.json({ success: true });
});

app.get('/api/admin/challenges', requireAdmin, (req, res) => {
  const challenges = [...db.challenges]
    .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
    .map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      points: c.points,
      hint1: c.hint1,
      hint2: c.hint2,
      hint3: c.hint3,
      order_num: c.order_num,
      created_at: c.created_at,
      hasFlag: !!(c.flagHash || c.flag),
      isSecure: !!c.flagHash,
    }));
  res.json(challenges);
});

app.post('/api/admin/challenges', requireAdmin, (req, res) => {
  const { title, description, category, points, flag, hint1, hint2, hint3 } = req.body;

  if (!title || !description || !category || !points || !flag) {
    return res.status(400).json({ error: 'Campos requeridos faltantes' });
  }

  const maxOrder = db.challenges.reduce((max, c) => Math.max(max, c.order_num || 0), 0);

  const challenge = {
    id: uuidv4(),
    title,
    description,
    category,
    points: parseInt(points),
    flagHash: hashFlag(flag),
    hint1: hint1 || null,
    hint2: hint2 || null,
    hint3: hint3 || null,
    order_num: maxOrder + 1,
    created_at: new Date().toISOString(),
  };

  db.challenges.push(challenge);
  saveDB(dbFiles.challenges, db.challenges);

  res.json({ success: true, id: challenge.id });
});

app.put('/api/admin/challenges/:id', requireAdmin, (req, res) => {
  const { title, description, category, points, flag, hint1, hint2, hint3 } = req.body;
  const idx = db.challenges.findIndex(c => c.id === req.params.id);

  if (idx === -1) return res.status(404).json({ error: 'Reto no encontrado' });

  const updated = {
    ...db.challenges[idx],
    title, description, category,
    points: parseInt(points),
    hint1: hint1 || null,
    hint2: hint2 || null,
    hint3: hint3 || null,
  };

  if (flag && flag.trim() !== '') {
    updated.flagHash = hashFlag(flag);
    delete updated.flag;
  }

  db.challenges[idx] = updated;
  saveDB(dbFiles.challenges, db.challenges);

  res.json({ success: true });
});

app.delete('/api/admin/challenges/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  db.submissions = db.submissions.filter(s => s.challenge_id !== id);
  db.hintUnlocks = db.hintUnlocks.filter(h => h.challenge_id !== id);
  db.challenges = db.challenges.filter(c => c.id !== id);

  saveDB(dbFiles.submissions, db.submissions);
  saveDB(dbFiles.hintUnlocks, db.hintUnlocks);
  saveDB(dbFiles.challenges, db.challenges);

  res.json({ success: true });
});

app.get('/api/admin/teams', requireAdmin, (req, res) => {
  const teams = db.teams.map(team => {
    const subs = db.submissions.filter(s => s.team_id === team.id);
    return {
      ...team,
      password: undefined,
      total_points: subs.reduce((sum, s) => sum + s.points_awarded, 0),
      challenges_solved: subs.length,
    };
  });
  res.json(teams);
});

app.delete('/api/admin/teams/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  db.submissions = db.submissions.filter(s => s.team_id !== id);
  db.hintUnlocks = db.hintUnlocks.filter(h => h.team_id !== id);
  db.teams = db.teams.filter(t => t.id !== id);

  saveDB(dbFiles.submissions, db.submissions);
  saveDB(dbFiles.hintUnlocks, db.hintUnlocks);
  saveDB(dbFiles.teams, db.teams);

  res.json({ success: true });
});

app.post('/api/admin/reset', requireAdmin, (req, res) => {
  db.submissions = [];
  db.hintUnlocks = [];
  db.teams = [];

  saveDB(dbFiles.submissions, db.submissions);
  saveDB(dbFiles.hintUnlocks, db.hintUnlocks);
  saveDB(dbFiles.teams, db.teams);

  res.json({ success: true });
});

app.post('/api/admin/migrate-flags', requireAdmin, (req, res) => {
  let migrated = 0;
  let secure = 0;

  db.challenges = db.challenges.map(ch => {
    if (ch.flag && !ch.flagHash) {
      migrated++;
      const updated = { ...ch, flagHash: hashFlag(ch.flag) };
      delete updated.flag;
      return updated;
    }
    if (ch.flagHash) secure++;
    return ch;
  });

  saveDB(dbFiles.challenges, db.challenges);
  res.json({ success: true, migrated, secure });
});

// ─── SPA fallback ───────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║          MARSEC CYBER RANGE — CTF Platform       ║
  ╠══════════════════════════════════════════════════╣
  ║  URL:    http://localhost:${PORT}                    ║
  ║  Admin:  admin / CTF@dm1n!2026$$SecurePwd         ║
  ║  Teams:  ${db.teams.length} registered                       ║
  ║  Retos:  ${db.challenges.length} loaded                          ║
  ╚══════════════════════════════════════════════════╝
  `);
});
