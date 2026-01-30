#!/usr/bin/env node
/**
 * Script de migración de flags
 * 
 * Este script convierte las flags en texto plano a hashes SHA256.
 * Ejecutar una sola vez para migrar los datos existentes.
 * 
 * Uso: node migrate-flags.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuración (debe coincidir con server.js)
const FLAG_SALT = process.env.FLAG_SALT || 'ctf-platform-secret-salt-2024';
const CHALLENGES_FILE = path.join(__dirname, 'data', 'challenges.json');

// Función de hash (igual que en server.js)
const hashFlag = (flag) => {
  const normalized = flag.trim();
  return crypto.createHash('sha256').update(FLAG_SALT + normalized).digest('hex');
};

// Cargar challenges
console.log('='.repeat(50));
console.log('   MIGRACIÓN DE FLAGS A HASH SHA256');
console.log('='.repeat(50));
console.log('');

if (!fs.existsSync(CHALLENGES_FILE)) {
  console.log('ERROR: No se encontró el archivo challenges.json');
  console.log(`Ruta buscada: ${CHALLENGES_FILE}`);
  process.exit(1);
}

const challenges = JSON.parse(fs.readFileSync(CHALLENGES_FILE, 'utf-8'));
console.log(`Encontrados ${challenges.length} retos.`);
console.log('');

let migratedCount = 0;
let alreadySecure = 0;
let noFlag = 0;

const migratedChallenges = challenges.map((challenge, index) => {
  const num = index + 1;
  
  if (challenge.flagHash && !challenge.flag) {
    // Ya tiene hash y no tiene flag en texto plano
    console.log(`[${num}] "${challenge.title}" - Ya seguro (hash)`);
    alreadySecure++;
    return challenge;
  }
  
  if (challenge.flag) {
    // Tiene flag en texto plano, migrar
    console.log(`[${num}] "${challenge.title}" - Migrando...`);
    console.log(`     Flag: ${challenge.flag.substring(0, 10)}...`);
    
    const updated = {
      ...challenge,
      flagHash: hashFlag(challenge.flag)
    };
    delete updated.flag; // Eliminar flag en texto plano
    
    console.log(`     Hash: ${updated.flagHash.substring(0, 20)}...`);
    migratedCount++;
    return updated;
  }
  
  console.log(`[${num}] "${challenge.title}" - SIN FLAG (revisar)`);
  noFlag++;
  return challenge;
});

console.log('');
console.log('-'.repeat(50));

// Crear backup antes de guardar
const backupFile = CHALLENGES_FILE.replace('.json', `.backup-${Date.now()}.json`);
fs.writeFileSync(backupFile, JSON.stringify(challenges, null, 2));
console.log(`Backup creado: ${path.basename(backupFile)}`);

// Guardar challenges migrados
fs.writeFileSync(CHALLENGES_FILE, JSON.stringify(migratedChallenges, null, 2));
console.log(`Guardado: challenges.json`);

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
console.log('Migración completada. Las flags ahora están hasheadas.');
console.log('IMPORTANTE: Guarda las flags originales en un lugar seguro offline.');
