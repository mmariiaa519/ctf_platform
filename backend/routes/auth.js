const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'marsec-dev-secret';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'MARSEC_admin_2026';

module.exports = (db) => {
  const router = express.Router();

  router.post('/register', async (req, res) => {
    const { teamName, password } = req.body;
    if (!teamName?.trim() || !password) {
      return res.status(400).json({ error: 'Nombre de equipo y contraseña requeridos' });
    }
    if (teamName.trim().length < 2 || teamName.trim().length > 30) {
      return res.status(400).json({ error: 'El nombre debe tener entre 2 y 30 caracteres' });
    }
    const existing = db.prepare('SELECT id FROM teams WHERE name = ?').get(teamName.trim());
    if (existing) return res.status(409).json({ error: 'Ese nombre de equipo ya está registrado' });

    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO teams (name, password_hash) VALUES (?, ?)').run(teamName.trim(), hash);

    db.prepare('INSERT INTO activity (team_name, type, message) VALUES (?, ?, ?)').run(
      teamName.trim(), 'system', `Equipo "${teamName.trim()}" se ha unido al ejercicio`
    );

    const token = jwt.sign({ teamId: result.lastInsertRowid, teamName: teamName.trim(), isAdmin: false }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, teamName: teamName.trim(), teamId: result.lastInsertRowid });
  });

  router.post('/login', async (req, res) => {
    const { teamName, password } = req.body;
    if (!teamName || !password) return res.status(400).json({ error: 'Credenciales requeridas' });

    const team = db.prepare('SELECT * FROM teams WHERE name = ?').get(teamName.trim());
    if (!team) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const valid = await bcrypt.compare(password, team.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const token = jwt.sign({ teamId: team.id, teamName: team.name, isAdmin: false }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, teamName: team.name, teamId: team.id });
  });

  router.post('/admin-login', (req, res) => {
    const { username, password } = req.body;
    if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Credenciales de administrador incorrectas' });
    }
    const token = jwt.sign({ isAdmin: true, username }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token });
  });

  return router;
};
