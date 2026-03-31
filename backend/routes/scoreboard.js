const express = require('express');

const computeScoreboard = (db) => {
  const teams = db.prepare('SELECT id, name FROM teams').all();

  return teams.map(team => {
    const solved = db.prepare(`
      SELECT DISTINCT c.id, c.points
      FROM submissions s JOIN challenges c ON c.id = s.challenge_id
      WHERE s.team_id = ? AND s.correct = 1
    `).all(team.id);

    const hintCost = db.prepare(`
      SELECT COALESCE(SUM(cost), 0) as total FROM hint_unlocks WHERE team_id = ?
    `).get(team.id).total;

    const lastSolve = db.prepare(`
      SELECT MAX(submitted_at) as ts FROM submissions WHERE team_id = ? AND correct = 1
    `).get(team.id).ts;

    const recentSolve = db.prepare(`
      SELECT id FROM submissions WHERE team_id = ? AND correct = 1
      AND submitted_at > datetime('now', '-5 minutes')
    `).get(team.id);

    const score = Math.max(0, solved.reduce((s, c) => s + c.points, 0) - hintCost);
    return {
      teamId: team.id,
      teamName: team.name,
      score,
      solvedCount: solved.length,
      lastSolve: lastSolve || null,
      trend: recentSolve ? 'up' : 'flat'
    };
  }).sort((a, b) => b.score - a.score || b.solvedCount - a.solvedCount || (a.lastSolve < b.lastSolve ? -1 : 1));
};

module.exports = (db) => {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(computeScoreboard(db));
  });

  router.get('/activity', (req, res) => {
    const events = db.prepare(
      'SELECT * FROM activity ORDER BY created_at DESC LIMIT 50'
    ).all();
    res.json(events);
  });

  router.get('/status', (req, res) => {
    const getSetting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
    res.json({
      ctfActive: getSetting('ctf_active') === '1',
      ctfEndTime: parseInt(getSetting('ctf_end_time') || '0'),
      timerDuration: parseInt(getSetting('timer_duration') || '7200'),
      totalChallenges: db.prepare('SELECT COUNT(*) as n FROM challenges WHERE active = 1').get().n,
      totalPoints: db.prepare('SELECT COALESCE(SUM(points), 0) as total FROM challenges WHERE active = 1').get().total
    });
  });

  return router;
};
