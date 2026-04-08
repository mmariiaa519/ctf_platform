/**
 * config.js — Configuracion compartida del servidor MARSEC CTF
 *
 * Centraliza valores criticos de seguridad para que todas las rutas
 * (challenges.js, admin.js) usen la misma fuente de verdad.
 *
 * FLAG_SALT se concatena con cada flag antes de aplicar SHA256.
 * Si se cambia este valor, TODOS los flagHash de challenges.json
 * dejaran de verificar — hay que regenerarlos con migrate-flags.js.
 *
 * Prioridad: variable de entorno FLAG_SALT > fallback hardcoded.
 */

const FLAG_SALT = process.env.FLAG_SALT || 'ctf-platform-secret-salt-2024';

module.exports = { FLAG_SALT };
