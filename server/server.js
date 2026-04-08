/**
 * server.js — Punto de entrada del servidor MARSEC CTF
 *
 * Arquitectura modular: este archivo solo configura Express y monta
 * las rutas. La logica de negocio esta en routes/ y middleware/.
 *
 * Flujo de arranque:
 *   1. Configura seguridad (helmet, CSP, trust proxy)
 *   2. Configura sesion (express-session con cookies seguras)
 *   3. Crea la cuenta admin por defecto si no existe
 *   4. Monta las 4 familias de rutas API
 *   5. Sirve el frontend React (build estatico en dist/)
 *   6. Escucha en el puerto configurado
 *
 * En Docker: el Dockerfile copia el build de client/ a server/dist/
 * En desarrollo: se usa start-client.mjs para el frontend con HMR
 */

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db, save } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

/** Detecta si estamos en produccion (Docker) o desarrollo local */
const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Trust proxy — necesario cuando Express esta detras de un reverse proxy
 * (Docker, nginx, Caddy). Sin esto:
 *   - express-rate-limit usa la IP del proxy en vez del cliente real
 *   - secure cookies no funcionan (proxy termina HTTPS, Express ve HTTP)
 */
if (IS_PROD) app.set('trust proxy', 1);

/**
 * Helmet — cabeceras HTTP de seguridad
 *
 * Content-Security-Policy (CSP): restringe origenes de scripts, estilos,
 * fuentes e imagenes. 'unsafe-inline' en styles es necesario porque React
 * inyecta estilos inline y usamos Google Fonts.
 *
 * crossOriginEmbedderPolicy: desactivado para permitir carga de fuentes
 * externas (Google Fonts) sin cabecera CORP.
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

/**
 * Body parsing — limita a 100kb para prevenir ataques de payload grande.
 * Solo aceptamos JSON (no formularios HTML tradicionales).
 */
app.use(express.json({ limit: '100kb' }));

/**
 * Sesion — almacenada en memoria del servidor (MemoryStore).
 *
 * - secret: firma la cookie de sesion (HMAC). Cambiar en produccion via env.
 * - resave: false = no reguarda sesiones sin cambios (ahorra I/O).
 * - saveUninitialized: false = no crea sesion para visitantes anonimos.
 * - name: nombre personalizado de la cookie (no expone "connect.sid").
 * - httpOnly: la cookie no es accesible desde JavaScript del navegador (anti-XSS).
 * - sameSite: 'strict' previene CSRF — la cookie no se envia en peticiones cross-site.
 * - secure: true en produccion = solo se envia por HTTPS.
 * - maxAge: 12 horas — duracion maxima del ejercicio CTF.
 */
app.use(session({
  secret: process.env.SESSION_SECRET || 'marsec-session-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  name: 'marsec.sid',
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PROD,
    maxAge: 12 * 60 * 60 * 1000, // 12 horas en milisegundos
  },
}));

/**
 * Admin por defecto — se crea al arrancar si no existe en admins.json.
 * Las credenciales vienen de variables de entorno (.env / docker-compose).
 * Aborta el servidor si la password es demasiado corta (< 8 caracteres).
 * bcrypt cost 12: ~40ms por hash — buen balance seguridad/rendimiento.
 */
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'CTF@dm1n!2026$SecurePwd';

if (ADMIN_PASS.length < 8) {
  console.error('[MARSEC] ADMIN_PASS demasiado corta (minimo 8 caracteres). Abortando.');
  process.exit(1);
}

if (!db.admins.find(a => a.username === ADMIN_USER)) {
  db.admins.push({
    id: uuidv4(),
    username: ADMIN_USER,
    password: bcrypt.hashSync(ADMIN_PASS, 12),
  });
  save('admins');
  console.log('[MARSEC] Admin account initialized');
}

/**
 * Montaje de rutas API — cada modulo gestiona un dominio funcional:
 *   /api          → auth.js    (register, login, logout, me, admin/login)
 *   /api/challenges → challenges.js (listar, submit flag, unlock hint)
 *   /api/scoreboard → scoreboard.js (ranking, historial por equipo)
 *   /api/admin    → admin.js   (CRUD retos, equipos, reset, stats)
 */
app.use('/api', require('./routes/auth'));
app.use('/api/challenges', require('./routes/challenges'));
app.use('/api/scoreboard', require('./routes/scoreboard'));
app.use('/api/admin', require('./routes/admin'));

/**
 * Servido del frontend (SPA) — archivos estaticos del build de React.
 * En Docker, el Dockerfile copia el build de Vite a server/dist/.
 * El catch-all (*) devuelve index.html para que React Router maneje
 * las rutas del lado cliente (login, dashboard, admin, etc.).
 */
const DIST = path.join(__dirname, 'dist');
app.use(express.static(DIST));
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

/** Arranque del servidor */
app.listen(PORT, () => {
  console.log(`[MARSEC] Componente Ciber — puerto ${PORT}`);
  console.log(`[MARSEC] ${db.teams.length} equipos, ${db.challenges.length} retos cargados`);
});
