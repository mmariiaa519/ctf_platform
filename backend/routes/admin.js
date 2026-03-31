const express = require('express');
const { requireAdmin } = require('../middleware/auth');

module.exports = (db) => {
  const router = express.Router();
  router.use(requireAdmin);

  const getSetting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
  const setSetting = (key, value) => db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));

  // --- Teams ---
  router.get('/teams', (req, res) => {
    const teams = db.prepare('SELECT id, name, created_at FROM teams').all();
    const result = teams.map(team => {
      const solved = db.prepare(`
        SELECT c.id, c.name, c.category, c.points, s.submitted_at
        FROM submissions s JOIN challenges c ON c.id = s.challenge_id
        WHERE s.team_id = ? AND s.correct = 1
      `).all(team.id);
      const hintCost = db.prepare('SELECT COALESCE(SUM(cost), 0) as total FROM hint_unlocks WHERE team_id = ?').get(team.id).total;
      const score = Math.max(0, solved.reduce((s, c) => s + c.points, 0) - hintCost);
      return { ...team, score, solved };
    });
    res.json(result);
  });

  // --- Challenges ---
  router.get('/challenges', (req, res) => {
    res.json(db.prepare('SELECT * FROM challenges ORDER BY order_index').all());
  });

  router.post('/challenges', (req, res) => {
    const { name, category, points, description, flag, hint, hint_cost, order_index } = req.body;
    if (!name || !category || !points || !description || !flag || !order_index) {
      return res.status(400).json({ error: 'Campos obligatorios: name, category, points, description, flag, order_index' });
    }
    try {
      const result = db.prepare(
        'INSERT INTO challenges (name, category, points, description, flag, hint, hint_cost, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(name, category, points, description, flag, hint || null, hint_cost || 50, order_index);
      res.json({ id: result.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: 'Error al crear reto: ' + e.message });
    }
  });

  router.put('/challenges/:id', (req, res) => {
    const { name, category, points, description, flag, hint, hint_cost, order_index, active } = req.body;
    const id = parseInt(req.params.id);
    try {
      db.prepare(`
        UPDATE challenges SET name=?, category=?, points=?, description=?, flag=?, hint=?, hint_cost=?, order_index=?, active=?
        WHERE id=?
      `).run(name, category, points, description, flag, hint || null, hint_cost || 50, order_index, active ?? 1, id);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: 'Error al actualizar: ' + e.message });
    }
  });

  router.delete('/challenges/:id', (req, res) => {
    db.prepare('DELETE FROM challenges WHERE id = ?').run(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // --- Timer ---
  router.get('/settings', (req, res) => {
    res.json({
      timerDuration: parseInt(getSetting('timer_duration') || '7200'),
      ctfActive: getSetting('ctf_active') === '1',
      ctfEndTime: parseInt(getSetting('ctf_end_time') || '0')
    });
  });

  router.post('/timer/start', (req, res) => {
    const duration = parseInt(getSetting('timer_duration') || '7200');
    const endTime = Date.now() + duration * 1000;
    setSetting('ctf_end_time', endTime);
    setSetting('ctf_active', '1');
    db.prepare('INSERT INTO activity (type, message) VALUES (?, ?)').run('system', 'El CTF ha comenzado');
    res.json({ ok: true, ctfEndTime: endTime });
  });

  router.post('/timer/stop', (req, res) => {
    setSetting('ctf_active', '0');
    db.prepare('INSERT INTO activity (type, message) VALUES (?, ?)').run('system', 'El CTF ha sido pausado por el administrador');
    res.json({ ok: true });
  });

  router.put('/timer', (req, res) => {
    const { duration } = req.body;
    if (!duration || duration < 60) return res.status(400).json({ error: 'Duración mínima: 60 segundos' });
    setSetting('timer_duration', duration);
    res.json({ ok: true });
  });

  // --- Reset ---
  router.post('/reset', (req, res) => {
    db.prepare('DELETE FROM submissions').run();
    db.prepare('DELETE FROM hint_unlocks').run();
    db.prepare('DELETE FROM activity').run();
    setSetting('ctf_active', '0');
    setSetting('ctf_end_time', '0');
    db.prepare('INSERT INTO activity (type, message) VALUES (?, ?)').run('system', 'Todas las puntuaciones han sido reseteadas por el administrador');
    res.json({ ok: true });
  });

  router.delete('/teams/:id', (req, res) => {
    const id = parseInt(req.params.id);
    db.prepare('DELETE FROM submissions WHERE team_id = ?').run(id);
    db.prepare('DELETE FROM hint_unlocks WHERE team_id = ?').run(id);
    db.prepare('DELETE FROM teams WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  return router;
};
