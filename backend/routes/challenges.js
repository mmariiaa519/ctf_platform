const express = require('express');
const { requireAuth } = require('../middleware/auth');

module.exports = (db) => {
  const router = express.Router();

  // Get all challenges with team's solve status
  router.get('/', requireAuth, (req, res) => {
    const { teamId } = req.user;
    const challenges = db.prepare('SELECT id, name, category, points, description, hint, hint_cost, order_index FROM challenges WHERE active = 1 ORDER BY order_index').all();

    const solvedIds = new Set(
      db.prepare('SELECT DISTINCT challenge_id FROM submissions WHERE team_id = ? AND correct = 1').all(teamId).map(r => r.challenge_id)
    );
    const hintIds = new Set(
      db.prepare('SELECT challenge_id FROM hint_unlocks WHERE team_id = ?').all(teamId).map(r => r.challenge_id)
    );

    const result = challenges.map(c => ({
      ...c,
      solved: solvedIds.has(c.id),
      hintUnlocked: hintIds.has(c.id),
      unlocked: c.order_index === 1 || solvedIds.has(
        challenges.find(prev => prev.order_index === c.order_index - 1)?.id
      )
    }));

    res.json(result);
  });

  // Submit flag
  router.post('/:id/submit', requireAuth, (req, res) => {
    const { teamId, teamName } = req.user;
    const challengeId = parseInt(req.params.id);
    const { flag } = req.body;

    if (!flag) return res.status(400).json({ error: 'Flag requerida' });

    const challenge = db.prepare('SELECT * FROM challenges WHERE id = ? AND active = 1').get(challengeId);
    if (!challenge) return res.status(404).json({ error: 'Reto no encontrado' });

    // Check already solved
    const alreadySolved = db.prepare('SELECT id FROM submissions WHERE team_id = ? AND challenge_id = ? AND correct = 1').get(teamId, challengeId);
    if (alreadySolved) return res.status(400).json({ error: 'Ya has resuelto este reto', alreadySolved: true });

    // Enforce kill chain: check previous challenge is solved
    if (challenge.order_index > 1) {
      const prev = db.prepare('SELECT id FROM challenges WHERE order_index = ?').get(challenge.order_index - 1);
      if (prev) {
        const prevSolved = db.prepare('SELECT id FROM submissions WHERE team_id = ? AND challenge_id = ? AND correct = 1').get(teamId, prev.id);
        if (!prevSolved) return res.status(403).json({ error: 'Debes completar el reto anterior primero' });
      }
    }

    const correct = flag.trim() === challenge.flag.trim();

    db.prepare('INSERT INTO submissions (team_id, challenge_id, correct) VALUES (?, ?, ?)').run(teamId, challengeId, correct ? 1 : 0);

    if (correct) {
      db.prepare('INSERT INTO activity (team_name, type, message, challenge_name) VALUES (?, ?, ?, ?)').run(
        teamName, 'solve', `${teamName} ha completado "${challenge.name}" (+${challenge.points} pts)`, challenge.name
      );
      res.json({ correct: true, points: challenge.points, message: `¡Flag correcta! +${challenge.points} puntos` });
    } else {
      db.prepare('INSERT INTO activity (team_name, type, message, challenge_name) VALUES (?, ?, ?, ?)').run(
        teamName, 'fail', `${teamName} ha fallado en "${challenge.name}"`, challenge.name
      );
      res.json({ correct: false, message: 'Flag incorrecta. Inténtalo de nuevo.' });
    }
  });

  // Unlock hint
  router.post('/:id/hint', requireAuth, (req, res) => {
    const { teamId, teamName } = req.user;
    const challengeId = parseInt(req.params.id);

    const challenge = db.prepare('SELECT * FROM challenges WHERE id = ? AND active = 1').get(challengeId);
    if (!challenge) return res.status(404).json({ error: 'Reto no encontrado' });
    if (!challenge.hint) return res.status(400).json({ error: 'Este reto no tiene pista' });

    const existing = db.prepare('SELECT id FROM hint_unlocks WHERE team_id = ? AND challenge_id = ?').get(teamId, challengeId);
    if (existing) return res.json({ hint: challenge.hint, cost: 0, alreadyUnlocked: true });

    db.prepare('INSERT INTO hint_unlocks (team_id, challenge_id, cost) VALUES (?, ?, ?)').run(teamId, challengeId, challenge.hint_cost);
    db.prepare('INSERT INTO activity (team_name, type, message, challenge_name) VALUES (?, ?, ?, ?)').run(
      teamName, 'hint', `${teamName} ha usado una pista en "${challenge.name}" (-${challenge.hint_cost} pts)`, challenge.name
    );

    res.json({ hint: challenge.hint, cost: challenge.hint_cost });
  });

  return router;
};
