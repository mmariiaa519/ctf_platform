/**
 * @module ChallengeCard
 * @description Renders the full table of CTF challenges on the Dashboard page.
 *
 * Despite the filename ("ChallengeCard"), the default export is `ChallengeList`,
 * which renders a professional data-table layout rather than individual cards.
 * This decision was made during the TRUST Lab redesign to give the challenge
 * view a more data-driven, operations-room feel.
 *
 * Table columns:
 * | # | Nombre (title + description) | Categoria (badge) | Puntos | Estado (solved/pending) |
 *
 * Each row is clickable and opens the ChallengeModal for flag submission.
 * Solved challenges appear at reduced opacity (0.72) to visually de-emphasize them.
 * Row entrance is staggered via CSS `animationDelay` for a cascading reveal effect.
 *
 * Category colors and labels are mapped from the challenge's `category` field
 * (e.g., "RECON", "INTRUSION") to CSS custom properties and Spanish display names.
 *
 * @see ChallengeModal — the modal opened when a row is clicked
 */

/**
 * @constant {Object<string, string>} CAT_COLORS
 * Maps each challenge category key to its corresponding CSS custom property.
 * These CSS variables are defined in `client/src/styles/index.css` and assign
 * a unique color to each kill-chain phase for visual differentiation.
 *
 * Categories follow a simplified MITRE ATT&CK / kill-chain progression:
 * RECON -> INTRUSION -> FORENSICS -> SIGINT -> PRIVESC -> PERSISTENCE -> CRYPTO
 */
const CAT_COLORS = {
  RECON:       'var(--cat-recon)',
  INTRUSION:   'var(--cat-intrusion)',
  FORENSICS:   'var(--cat-forensics)',
  SIGINT:      'var(--cat-sigint)',
  PRIVESC:     'var(--cat-privesc)',
  PERSISTENCE: 'var(--cat-persistence)',
  CRYPTO:      'var(--cat-crypto)',
};

/**
 * @constant {Object<string, string>} CAT_LABELS
 * Maps each challenge category key to its human-readable Spanish label.
 * Displayed inside the category badge in each table row.
 *
 * Spanish translations:
 * - RECON       -> "Reconocimiento" (Reconnaissance)
 * - INTRUSION   -> "Intrusion" (same in Spanish)
 * - FORENSICS   -> "Analisis forense" (Forensic Analysis)
 * - SIGINT      -> "Inteligencia" (Intelligence / Signals Intelligence)
 * - PRIVESC     -> "Escalada de privilegios" (Privilege Escalation)
 * - PERSISTENCE -> "Persistencia" (Persistence)
 * - CRYPTO      -> "Criptoanálisis" (Cryptanalysis)
 */
const CAT_LABELS = {
  RECON:       'Reconocimiento',
  INTRUSION:   'Intrusion',
  FORENSICS:   'Analisis forense',
  SIGINT:      'Inteligencia',
  PRIVESC:     'Escalada de privilegios',
  PERSISTENCE: 'Persistencia',
  CRYPTO:      'Criptoanálisis',
};

/**
 * CheckIcon
 * @description Inline SVG checkmark icon used in the "Resuelto" (Solved) badge.
 * Renders a 13x13 SVG with a single checkmark path using `currentColor`,
 * so it inherits the text color of its parent element (--success green).
 *
 * @returns {JSX.Element} An inline <svg> checkmark icon.
 */
function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
    </svg>
  );
}

/**
 * ChallengeList (default export)
 * @description Renders all available challenges in a styled HTML table.
 *
 * Behaviour:
 * - If the `challenges` array is empty, displays a centered "Sin retos disponibles"
 *   (No challenges available) message.
 * - Each row maps a challenge object to a table row with: index number, title
 *   (with truncated description), category badge, point value, and solved status.
 * - Clicking any row calls `onSelect(challenge)` which opens the ChallengeModal.
 *
 * @param {Object} props
 * @param {Array<Object>} props.challenges - Array of challenge objects. Each must have:
 *   - {string} id         — unique identifier
 *   - {string} title      — challenge display name
 *   - {string} description — short description (truncated in the table cell)
 *   - {string} category   — one of the CAT_COLORS keys (e.g., "RECON")
 *   - {number} points     — point value awarded for solving
 *   - {boolean} solved    — whether the current team has already solved this challenge
 * @param {Function} props.onSelect - Callback invoked with the challenge object when
 *   a row is clicked. The parent (Dashboard) uses this to open the ChallengeModal.
 * @returns {JSX.Element} A styled table wrapped in a bordered container, or an
 *   empty-state message.
 */
export default function ChallengeList({ challenges, onSelect }) {
  /* Empty state: shown when no challenges have been loaded or created yet */
  if (!challenges.length) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        Sin retos disponibles.
      </div>
    );
  }

  return (
    /* Outer container: dark background with border, matching the platform design system */
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      {/* Table uses the global `.challenge-table` class from index.css for
          consistent row styling, hover effects, and responsive padding */}
      <table className="challenge-table">
        <thead>
          <tr>
            {/* Column headers — Spanish labels:
                # = row number, Nombre = Name, Categoria = Category,
                Puntos = Points, Estado = Status */}
            <th style={{ width: '2.5rem', paddingLeft: '1.25rem' }}>#</th>
            <th>Nombre</th>
            <th>Categoria</th>
            <th style={{ textAlign: 'right' }}>Puntos</th>
            <th style={{ textAlign: 'center', width: '7rem' }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {challenges.map((c, idx) => {
            /*
             * Resolve the category color for this challenge.
             * Falls back to --text-muted if the category key is not in CAT_COLORS
             * (e.g., if a new category is added to challenges.json but not mapped here).
             */
            const color = CAT_COLORS[c.category] || 'var(--text-muted)';
            return (
              <tr
                key={c.id}
                /* Clicking the row opens the ChallengeModal for this challenge */
                onClick={() => onSelect(c)}
                style={{
                  /* Solved challenges are visually dimmed to 72% opacity */
                  opacity: c.solved ? 0.72 : 1,
                  /* Staggered animation: each row fades in 40ms after the previous one */
                  animationDelay: `${idx * 0.04}s`,
                }}
              >
                {/* Column 1: Row index (1-based, displayed in monospace for alignment) */}
                <td style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                  {idx + 1}
                </td>

                {/* Column 2: Challenge title + truncated description */}
                <td>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.title}</span>
                  {/* Description line: single-line with ellipsis overflow at 480px max-width */}
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem', lineHeight: 1.4, maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.description}
                  </div>
                </td>

                {/* Column 3: Category badge with color-coded background.
                    Uses CSS color-mix to create a 14% tinted background from the category color,
                    giving a subtle highlight without overpowering the text. */}
                <td>
                  <span
                    className="badge"
                    style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
                  >
                    {/* Display the Spanish label; fall back to raw category key */}
                    {CAT_LABELS[c.category] || c.category}
                  </span>
                </td>

                {/* Column 4: Point value — right-aligned, monospace, bold, category-colored */}
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem', color }}>
                  {c.points}
                </td>

                {/* Column 5: Solved status — green checkmark + "Resuelto" or muted "Pendiente" */}
                <td style={{ textAlign: 'center' }}>
                  {c.solved ? (
                    /* "Resuelto" = Solved (Spanish). Uses .solved-check class for green styling. */
                    <span className="solved-check">
                      <CheckIcon /> Resuelto
                    </span>
                  ) : (
                    /* "Pendiente" = Pending (Spanish). Muted text for unsolved challenges. */
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pendiente</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
