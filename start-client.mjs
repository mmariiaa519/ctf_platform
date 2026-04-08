/**
 * start-client.mjs — Arranca el servidor de desarrollo Vite para el frontend
 *
 * Este script existe para que .claude/launch.json pueda arrancar Vite
 * con un simple `node start-client.mjs` (sin necesitar npx ni npm).
 *
 * Importa Vite directamente desde el node_modules del cliente y lo configura
 * para servir en localhost:5173. El proxy de Vite (definido en client/vite.config.js)
 * redirige las peticiones /api al backend en localhost:3000.
 *
 * Flujo de desarrollo:
 *   Terminal 1: node server/server.js         (backend en :3000)
 *   Terminal 2: node start-client.mjs         (frontend en :5173 con HMR)
 *
 * En produccion (Docker), este archivo NO se usa — Vite genera un build
 * estatico que el servidor Express sirve desde server/dist/.
 */

import { createServer } from './client/node_modules/vite/dist/node/index.js';
import { fileURLToPath } from 'url';
import path from 'path';

/** Resuelve la ruta absoluta al directorio client/ desde la ubicacion de este script */
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'client');

/** Crea el servidor Vite con la configuracion del proyecto */
const server = await createServer({
  root,
  configFile: path.join(root, 'vite.config.js'),
  server: { port: 5173, host: 'localhost' },
  logLevel: 'info',
});

/** Arranca el servidor y muestra las URLs disponibles en consola */
await server.listen();
server.printUrls();
