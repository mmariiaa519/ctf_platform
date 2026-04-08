#!/usr/bin/env node
/**
 * migrate-flags.js — Herramienta de migracion de flags a SHA256
 *
 * Convierte flags almacenadas en texto plano (propiedad `flag`) a hashes
 * SHA256 (propiedad `flagHash`) en data/challenges.json.
 *
 * Uso:
 *   node migrate-flags.js
 *
 * Comportamiento:
 *   1. Carga challenges.json
 *   2. Para cada reto:
 *      - Si ya tiene flagHash y no tiene flag en texto plano → lo salta
 *      - Si tiene flag en texto plano → genera el hash y elimina la propiedad flag
 *      - Si no tiene ninguna flag → lo reporta como advertencia
 *   3. Crea un backup timestamped antes de guardar
 *   4. Guarda el archivo actualizado
 *
 * IMPORTANTE:
 *   - FLAG_SALT debe coincidir con el valor en server/config.js
 *   - Ejecutar solo UNA vez (es idempotente, pero el backup se acumula)
 *   - Guardar las flags originales en un lugar seguro offline antes de migrar
 *
 * @see server/config.js — fuente de verdad del FLAG_SALT
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Salt para hashing de flags.
 * DEBE ser identico al de server/config.js y server/routes/challenges.js
 * para que los hashes generados aqui sean verificables por el servidor.
 */
const FLAG_SALT = process.env.FLAG_SALT || 'ctf-platform-secret-salt-2024';

/** Ruta al archivo de retos — relativa a la raiz del proyecto */
const CHALLENGES_FILE = path.join(__dirname, 'data', 'challenges.json');

/**
 * Genera un hash SHA256 de un flag.
 * Replica exactamente la logica de server/routes/challenges.js:hashFlag()
 * @param {string} flag - Flag en texto plano
 * @returns {string} Hash hexadecimal de 64 caracteres
 */
const hashFlag = (flag) => {
  const normalized = flag.trim();
  return crypto.createHash('sha256').update(FLAG_SALT + normalized).digest('hex');
};

// ── Inicio de la migracion ──────────────────────────────────

console.log('='.repeat(50));
console.log('   MIGRACION DE FLAGS A HASH SHA256');
console.log('='.repeat(50));
console.log('');

/* Verificar que el archivo de retos existe */
if (!fs.existsSync(CHALLENGES_FILE)) {
  console.log('ERROR: No se encontro el archivo challenges.json');
  console.log(`Ruta buscada: ${CHALLENGES_FILE}`);
  process.exit(1);
}

/* Cargar los retos actuales */
const challenges = JSON.parse(fs.readFileSync(CHALLENGES_FILE, 'utf-8'));
console.log(`Encontrados ${challenges.length} retos.`);
console.log('');

/** Contadores para el resumen final */
let migratedCount = 0;
let alreadySecure = 0;
let noFlag = 0;

/**
 * Recorre cada reto y decide si necesita migracion:
 * - flagHash presente + sin flag → ya seguro, no tocar
 * - flag presente → migrar a flagHash y eliminar flag en texto plano
 * - sin flag ni flagHash → reportar como problema
 */
const migratedChallenges = challenges.map((challenge, index) => {
  const num = index + 1;

  if (challenge.flagHash && !challenge.flag) {
    /* El reto ya usa hash — no requiere migracion */
    console.log(`[${num}] "${challenge.title}" - Ya seguro (hash)`);
    alreadySecure++;
    return challenge;
  }

  if (challenge.flag) {
    /* Migrar: generar hash y eliminar la flag en texto plano */
    console.log(`[${num}] "${challenge.title}" - Migrando...`);
    console.log(`     Flag: ${challenge.flag.substring(0, 10)}...`);

    const updated = {
      ...challenge,
      flagHash: hashFlag(challenge.flag)
    };
    delete updated.flag; // Eliminar flag en texto plano del objeto

    console.log(`     Hash: ${updated.flagHash.substring(0, 20)}...`);
    migratedCount++;
    return updated;
  }

  /* El reto no tiene flag — posible error de configuracion */
  console.log(`[${num}] "${challenge.title}" - SIN FLAG (revisar)`);
  noFlag++;
  return challenge;
});

console.log('');
console.log('-'.repeat(50));

/* Crear backup con timestamp antes de sobrescribir */
const backupFile = CHALLENGES_FILE.replace('.json', `.backup-${Date.now()}.json`);
fs.writeFileSync(backupFile, JSON.stringify(challenges, null, 2));
console.log(`Backup creado: ${path.basename(backupFile)}`);

/* Guardar los retos migrados */
fs.writeFileSync(CHALLENGES_FILE, JSON.stringify(migratedChallenges, null, 2));
console.log(`Guardado: challenges.json`);

/* Resumen de la migracion */
console.log('');
console.log('='.repeat(50));
console.log('   RESUMEN');
console.log('='.repeat(50));
console.log(`   Migradas:      ${migratedCount}`);
console.log(`   Ya seguras:    ${alreadySecure}`);
console.log(`   Sin flag:      ${noFlag}`);
console.log(`   Total:         ${challenges.length}`);
console.log('='.repeat(50));
console.log('');
console.log('Migracion completada. Las flags ahora estan hasheadas.');
console.log('IMPORTANTE: Guarda las flags originales en un lugar seguro offline.');
