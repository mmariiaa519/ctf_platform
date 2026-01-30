const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Flag hashing configuration
const FLAG_SALT = process.env.FLAG_SALT || 'ctf-platform-secret-salt-2024';

// Hash a flag using SHA256 with salt
const hashFlag = (flag) => {
  const normalized = flag.trim();
  return crypto.createHash('sha256').update(FLAG_SALT + normalized).digest('hex');
};

// Verify a flag against its hash
const verifyFlag = (submittedFlag, storedHash) => {
  const submittedHash = hashFlag(submittedFlag);
  return crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(storedHash));
};

// Rate limiting for flag submissions
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_ATTEMPTS = 10; // Max 10 attempts per minute per team

const checkRateLimit = (teamId) => {
  const now = Date.now();
  const teamAttempts = rateLimitMap.get(teamId) || [];
  
  // Filter attempts within the window
  const recentAttempts = teamAttempts.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentAttempts.length >= RATE_LIMIT_MAX_ATTEMPTS) {
    return false; // Rate limited
  }
  
  recentAttempts.push(now);
  rateLimitMap.set(teamId, recentAttempts);
  return true;
};

const app = express();
const PORT = process.env.PORT || 3000;

// JSON Database
const DB_PATH = path.join(__dirname, 'data');
if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH);
}

const dbFiles = {
  teams: path.join(DB_PATH, 'teams.json'),
  challenges: path.join(DB_PATH, 'challenges.json'),
  submissions: path.join(DB_PATH, 'submissions.json'),
  hintUnlocks: path.join(DB_PATH, 'hint_unlocks.json'),
  admins: path.join(DB_PATH, 'admins.json')
};

// Database helpers
const loadDB = (file) => {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (e) {}
  return [];
};

const saveDB = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

// Initialize database
let db = {
  teams: loadDB(dbFiles.teams),
  challenges: loadDB(dbFiles.challenges),
  submissions: loadDB(dbFiles.submissions),
  hintUnlocks: loadDB(dbFiles.hintUnlocks),
  admins: loadDB(dbFiles.admins)
};

// Create default admin if not exists
if (!db.admins.find(a => a.username === 'admin')) {
  const hashedPassword = bcrypt.hashSync('CTF@dm1n!2026$SecurePwd', 10);
  db.admins.push({ id: uuidv4(), username: 'admin', password: hashedPassword });
  saveDB(dbFiles.admins, db.admins);
  console.log('Default admin created: admin / CTF@dm1n!2026$SecurePwd');
}

// Insert sample challenges if none exist
if (db.challenges.length === 0) {
  const sampleChallenges = [
    {
      id: uuidv4(),
      title: 'Bienvenida',
      description: 'Este es tu primer reto. La flag está escondida en el código fuente de esta página. Inspecciona bien...',
      category: 'Web',
      points: 100,
      flagHash: hashFlag('CTF{welcome_to_the_game}'),
      hint1: 'Usa las herramientas de desarrollador del navegador',
      hint2: 'Busca en los comentarios HTML',
      hint3: 'Ctrl+U o F12 son tus amigos',
      order_num: 0,
      created_at: new Date().toISOString()
    },
    {
      id: uuidv4(),
      title: 'Base64 Básico',
      description: 'Decodifica este mensaje: Q1RGe2Jhc2U2NF9pc19ub3RfZW5jcnlwdGlvbn0=',
      category: 'Crypto',
      points: 100,
      flagHash: hashFlag('CTF{base64_is_not_encryption}'),
      hint1: 'El nombre del reto es una pista',
      hint2: 'Base64 es una codificación, no cifrado',
      hint3: 'Usa CyberChef o cualquier decodificador online',
      order_num: 1,
      created_at: new Date().toISOString()
    },
    {
      id: uuidv4(),
      title: 'Robots Escondidos',
      description: 'Los robots a veces esconden secretos. ¿Dónde buscarías información que no quieres que los buscadores indexen?',
      category: 'Web',
      points: 300,
      flagHash: hashFlag('CTF{robots_txt_is_public}'),
      hint1: 'Piensa en archivos que los crawlers de búsqueda leen',
      hint2: 'El archivo tiene un nombre muy descriptivo',
      hint3: '/robots.txt',
      order_num: 2,
      created_at: new Date().toISOString()
    },
    {
      id: uuidv4(),
      title: 'César Digital',
      description: 'Mensaje interceptado: FWI{urwduh_lv_qrw_vhfxuh}. El emperador romano estaría orgulloso.',
      category: 'Crypto',
      points: 300,
      flagHash: hashFlag('CTF{rotate_is_not_secure}'),
      hint1: 'Julio César usaba este cifrado',
      hint2: 'Es una rotación del alfabeto',
      hint3: 'ROT3 o Caesar cipher con shift de 3',
      order_num: 3,
      created_at: new Date().toISOString()
    },
    {
      id: uuidv4(),
      title: 'Hexadecimal Hell',
      description: '43 54 46 7b 68 65 78 5f 69 73 5f 6a 75 73 74 5f 62 61 73 65 31 36 7d',
      category: 'Crypto',
      points: 300,
      flagHash: hashFlag('CTF{hex_is_just_base16}'),
      hint1: 'Los números van del 0-9 y letras a-f',
      hint2: 'Hexadecimal es base 16',
      hint3: 'Convierte cada par de caracteres a ASCII',
      order_num: 4,
      created_at: new Date().toISOString()
    },
    {
      id: uuidv4(),
      title: 'SQL Injection 101',
      description: 'La página de login tiene una vulnerabilidad clásica. El admin dejó una nota: "La flag está en la tabla secrets". Usuario: admin',
      category: 'Web',
      points: 500,
      flagHash: hashFlag('CTF{sql_injection_is_still_alive}'),
      hint1: 'Piensa en cómo se construyen las consultas SQL',
      hint2: '\' OR \'1\'=\'1 es un clásico',
      hint3: 'Intenta: admin\' --',
      order_num: 5,
      created_at: new Date().toISOString()
    },
    {
      id: uuidv4(),
      title: 'Esteganografía Básica',
      description: 'Una imagen vale más que mil palabras... y a veces esconde secretos. Descarga la imagen del servidor y encuentra lo oculto.',
      category: 'Forensics',
      points: 500,
      flagHash: hashFlag('CTF{hidden_in_plain_sight}'),
      hint1: 'Los archivos pueden contener más de lo que ves',
      hint2: 'Herramientas: strings, binwalk, steghide',
      hint3: 'Prueba: strings imagen.png | grep CTF',
      order_num: 6,
      created_at: new Date().toISOString()
    },
    {
      id: uuidv4(),
      title: 'JWT Vulnerable',
      description: 'El sistema usa JWT para autenticación. ¿Puedes convertirte en admin? Token actual: eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VyIjoiZ3Vlc3QiLCJyb2xlIjoiZ3Vlc3QifQ.',
      category: 'Web',
      points: 500,
      flagHash: hashFlag('CTF{jwt_none_algorithm_attack}'),
      hint1: 'Analiza la estructura del JWT',
      hint2: 'El algoritmo "none" es peligroso',
      hint3: 'Cambia el payload a role:admin y usa alg:none',
      order_num: 7,
      created_at: new Date().toISOString()
    },
    {
      id: uuidv4(),
      title: 'Reverse Engineering',
      description: 'El binario contiene una función de validación. La contraseña correcta te dará la flag. Analiza el flujo del programa.',
      category: 'Reversing',
      points: 1000,
      flagHash: hashFlag('CTF{reverse_engineering_master}'),
      hint1: 'Usa herramientas como Ghidra o IDA',
      hint2: 'Busca strings interesantes en el binario',
      hint3: 'La comparación de strings revela la contraseña',
      order_num: 8,
      created_at: new Date().toISOString()
    },
    {
      id: uuidv4(),
      title: 'Buffer Overflow',
      description: 'El programa vulnerable tiene un buffer de 64 bytes. ¿Puedes sobrescribir la dirección de retorno para ejecutar la función win()?',
      category: 'Pwn',
      points: 1000,
      flagHash: hashFlag('CTF{buffer_overflow_champion}'),
      hint1: 'Encuentra el offset exacto para sobrescribir EIP',
      hint2: 'Usa pattern_create y pattern_offset',
      hint3: 'Payload: 72 bytes de padding + dirección de win()',
      order_num: 9,
      created_at: new Date().toISOString()
    }
  ];

  db.challenges = sampleChallenges;
  saveDB(dbFiles.challenges, db.challenges);
  console.log('Sample challenges created (with secure hashed flags)');
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'ctf-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Helper functions
const calculatePoints = (basePoints, hintsUsed) => {
  const multipliers = [1, 0.75, 0.5, 0.3];
  return Math.floor(basePoints * multipliers[Math.min(hintsUsed, 3)]);
};

// API Routes

// Team Registration
app.post('/api/register', (req, res) => {
  const { name, password } = req.body;
  
  if (!name || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
  }

  if (name.length < 3 || name.length > 30) {
    return res.status(400).json({ error: 'El nombre debe tener entre 3 y 30 caracteres' });
  }

  if (db.teams.find(t => t.name === name)) {
    return res.status(400).json({ error: 'El nombre de equipo ya existe' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const team = {
    id: uuidv4(),
    name,
    password: hashedPassword,
    created_at: new Date().toISOString()
  };
  
  db.teams.push(team);
  saveDB(dbFiles.teams, db.teams);
  
  req.session.teamId = team.id;
  req.session.teamName = name;
  
  res.json({ success: true, teamName: name });
});

// Team Login
app.post('/api/login', (req, res) => {
  const { name, password } = req.body;

  if (!name || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
  }

  const team = db.teams.find(t => t.name === name);
  if (!team || !bcrypt.compareSync(password, team.password)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  req.session.teamId = team.id;
  req.session.teamName = team.name;
  
  res.json({ success: true, teamName: team.name });
});

// Team Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get current team
app.get('/api/me', (req, res) => {
  if (!req.session.teamId) {
    return res.json({ authenticated: false });
  }
  res.json({ 
    authenticated: true, 
    teamName: req.session.teamName,
    isAdmin: req.session.isAdmin || false
  });
});

// Get all challenges (without flags)
app.get('/api/challenges', (req, res) => {
  const challenges = [...db.challenges].sort((a, b) => a.order_num - b.order_num || a.points - b.points);

  let solvedMap = {};
  let hintsMap = {};
  
  if (req.session.teamId) {
    const solved = db.submissions.filter(s => s.team_id === req.session.teamId);
    solved.forEach(s => {
      solvedMap[s.challenge_id] = s.hints_used;
    });

    const hints = db.hintUnlocks.filter(h => h.team_id === req.session.teamId);
    hints.forEach(h => {
      if (!hintsMap[h.challenge_id]) hintsMap[h.challenge_id] = [];
      hintsMap[h.challenge_id].push(h.hint_number);
    });
  }

  const result = challenges.map(c => ({
    id: c.id,
    title: c.title,
    description: c.description,
    category: c.category,
    points: c.points,
    order_num: c.order_num,
    solved: solvedMap.hasOwnProperty(c.id),
    hintsUsed: solvedMap[c.id] || 0,
    unlockedHints: hintsMap[c.id] || [],
    hint1: hintsMap[c.id]?.includes(1) ? c.hint1 : null,
    hint2: hintsMap[c.id]?.includes(2) ? c.hint2 : null,
    hint3: hintsMap[c.id]?.includes(3) ? c.hint3 : null
  }));

  res.json(result);
});

// Submit flag
app.post('/api/submit', (req, res) => {
  if (!req.session.teamId) {
    return res.status(401).json({ error: 'Debes iniciar sesión' });
  }

  const { challengeId, flag } = req.body;

  if (!challengeId || !flag) {
    return res.status(400).json({ error: 'Challenge ID y flag requeridos' });
  }

  // Rate limiting check
  if (!checkRateLimit(req.session.teamId)) {
    return res.status(429).json({ 
      error: 'Demasiados intentos. Espera un minuto antes de intentar de nuevo.',
      rateLimited: true 
    });
  }

  // Check if already solved
  if (db.submissions.find(s => s.team_id === req.session.teamId && s.challenge_id === challengeId)) {
    return res.status(400).json({ error: 'Ya has resuelto este reto' });
  }

  // Get challenge
  const challenge = db.challenges.find(c => c.id === challengeId);
  if (!challenge) {
    return res.status(404).json({ error: 'Reto no encontrado' });
  }

  // Check flag using secure hash comparison
  // Support both hashed flags (new) and plain text flags (legacy - will be migrated)
  let isCorrect = false;
  if (challenge.flagHash) {
    // New secure method: compare hashes
    try {
      isCorrect = verifyFlag(flag, challenge.flagHash);
    } catch (e) {
      isCorrect = false;
    }
  } else if (challenge.flag) {
    // Legacy: plain text comparison (for backwards compatibility during migration)
    isCorrect = flag.trim() === challenge.flag;
  }

  if (!isCorrect) {
    return res.json({ correct: false, message: 'Flag incorrecta' });
  }

  // Get hints used
  const hintsUsed = db.hintUnlocks.filter(h => h.team_id === req.session.teamId && h.challenge_id === challengeId).length;
  const pointsAwarded = calculatePoints(challenge.points, hintsUsed);

  // Record submission
  const submission = {
    id: uuidv4(),
    team_id: req.session.teamId,
    challenge_id: challengeId,
    points_awarded: pointsAwarded,
    hints_used: hintsUsed,
    submitted_at: new Date().toISOString()
  };
  db.submissions.push(submission);
  saveDB(dbFiles.submissions, db.submissions);

  res.json({ 
    correct: true, 
    message: '¡Flag correcta!', 
    pointsAwarded,
    hintsUsed
  });
});

// Unlock hint
app.post('/api/hint', (req, res) => {
  if (!req.session.teamId) {
    return res.status(401).json({ error: 'Debes iniciar sesión' });
  }

  const { challengeId, hintNumber } = req.body;

  if (!challengeId || !hintNumber || hintNumber < 1 || hintNumber > 3) {
    return res.status(400).json({ error: 'Parámetros inválidos' });
  }

  // Check if already solved
  if (db.submissions.find(s => s.team_id === req.session.teamId && s.challenge_id === challengeId)) {
    return res.status(400).json({ error: 'Ya has resuelto este reto' });
  }

  // Check if hint already unlocked
  if (db.hintUnlocks.find(h => h.team_id === req.session.teamId && h.challenge_id === challengeId && h.hint_number === hintNumber)) {
    return res.status(400).json({ error: 'Pista ya desbloqueada' });
  }

  // Check previous hints are unlocked
  if (hintNumber > 1) {
    const prevHint = db.hintUnlocks.find(h => h.team_id === req.session.teamId && h.challenge_id === challengeId && h.hint_number === hintNumber - 1);
    if (!prevHint) {
      return res.status(400).json({ error: 'Debes desbloquear las pistas anteriores primero' });
    }
  }

  // Get challenge
  const challenge = db.challenges.find(c => c.id === challengeId);
  if (!challenge) {
    return res.status(404).json({ error: 'Reto no encontrado' });
  }

  const hintText = challenge[`hint${hintNumber}`];
  if (!hintText) {
    return res.status(400).json({ error: 'Esta pista no está disponible' });
  }

  // Unlock hint
  const hintUnlock = {
    id: uuidv4(),
    team_id: req.session.teamId,
    challenge_id: challengeId,
    hint_number: hintNumber,
    unlocked_at: new Date().toISOString()
  };
  db.hintUnlocks.push(hintUnlock);
  saveDB(dbFiles.hintUnlocks, db.hintUnlocks);

  // Calculate new potential points
  const totalHints = hintNumber;
  const newPoints = calculatePoints(challenge.points, totalHints);

  res.json({ 
    success: true, 
    hint: hintText,
    newMaxPoints: newPoints,
    hintsUsed: totalHints
  });
});

// Scoreboard
app.get('/api/scoreboard', (req, res) => {
  const teamScores = db.teams.map(team => {
    const teamSubmissions = db.submissions.filter(s => s.team_id === team.id);
    const totalPoints = teamSubmissions.reduce((sum, s) => sum + s.points_awarded, 0);
    const lastSolve = teamSubmissions.length > 0 
      ? teamSubmissions.reduce((latest, s) => s.submitted_at > latest ? s.submitted_at : latest, '')
      : null;

    return {
      id: team.id,
      name: team.name,
      joined: team.created_at,
      total_points: totalPoints,
      challenges_solved: teamSubmissions.length,
      last_solve: lastSolve
    };
  });

  // Sort by points (desc), then by last solve time (asc)
  teamScores.sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    if (!a.last_solve) return 1;
    if (!b.last_solve) return -1;
    return new Date(a.last_solve) - new Date(b.last_solve);
  });

  // Add rank
  teamScores.forEach((team, index) => {
    team.rank = index + 1;
  });

  res.json(teamScores);
});

// Get team's submission history
app.get('/api/submissions/:teamId', (req, res) => {
  const submissions = db.submissions
    .filter(s => s.team_id === req.params.teamId)
    .map(s => {
      const challenge = db.challenges.find(c => c.id === s.challenge_id);
      return {
        submitted_at: s.submitted_at,
        points_awarded: s.points_awarded,
        hints_used: s.hints_used,
        challenge_title: challenge?.title || 'Unknown',
        category: challenge?.category || 'Unknown',
        base_points: challenge?.points || 0
      };
    })
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

  res.json(submissions);
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  const admin = db.admins.find(a => a.username === username);
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  req.session.isAdmin = true;
  req.session.adminId = admin.id;
  req.session.teamName = 'Admin';
  req.session.teamId = 'admin';
  
  res.json({ success: true });
});

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (!req.session.isAdmin) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
};

// Admin: Get all challenges (without exposing flags)
app.get('/api/admin/challenges', requireAdmin, (req, res) => {
  const challenges = [...db.challenges]
    .sort((a, b) => a.order_num - b.order_num || a.points - b.points)
    .map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      points: c.points,
      hint1: c.hint1,
      hint2: c.hint2,
      hint3: c.hint3,
      order_num: c.order_num,
      created_at: c.created_at,
      hasFlag: !!(c.flagHash || c.flag), // Indicate if flag is set, but don't expose it
      isSecure: !!c.flagHash // Indicate if using new secure hash
    }));
  res.json(challenges);
});

// Admin: Create challenge
app.post('/api/admin/challenges', requireAdmin, (req, res) => {
  const { title, description, category, points, flag, hint1, hint2, hint3 } = req.body;

  if (!title || !description || !category || !points || !flag) {
    return res.status(400).json({ error: 'Campos requeridos faltantes' });
  }

  const maxOrder = db.challenges.reduce((max, c) => Math.max(max, c.order_num || 0), 0);
  
  const challenge = {
    id: uuidv4(),
    title,
    description,
    category,
    points: parseInt(points),
    flagHash: hashFlag(flag), // Store hash instead of plain text
    hint1: hint1 || null,
    hint2: hint2 || null,
    hint3: hint3 || null,
    order_num: maxOrder + 1,
    created_at: new Date().toISOString()
  };

  db.challenges.push(challenge);
  saveDB(dbFiles.challenges, db.challenges);

  res.json({ success: true, id: challenge.id });
});

// Admin: Update challenge
app.put('/api/admin/challenges/:id', requireAdmin, (req, res) => {
  const { title, description, category, points, flag, hint1, hint2, hint3 } = req.body;

  const index = db.challenges.findIndex(c => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Reto no encontrado' });
  }

  const updateData = {
    ...db.challenges[index],
    title,
    description,
    category,
    points: parseInt(points),
    hint1: hint1 || null,
    hint2: hint2 || null,
    hint3: hint3 || null
  };

  // Only update flag hash if a new flag is provided
  if (flag && flag.trim() !== '') {
    updateData.flagHash = hashFlag(flag);
    delete updateData.flag; // Remove legacy plain text flag if exists
  }

  db.challenges[index] = updateData;

  saveDB(dbFiles.challenges, db.challenges);
  res.json({ success: true });
});

// Admin: Delete challenge
app.delete('/api/admin/challenges/:id', requireAdmin, (req, res) => {
  db.submissions = db.submissions.filter(s => s.challenge_id !== req.params.id);
  db.hintUnlocks = db.hintUnlocks.filter(h => h.challenge_id !== req.params.id);
  db.challenges = db.challenges.filter(c => c.id !== req.params.id);
  
  saveDB(dbFiles.submissions, db.submissions);
  saveDB(dbFiles.hintUnlocks, db.hintUnlocks);
  saveDB(dbFiles.challenges, db.challenges);
  
  res.json({ success: true });
});

// Admin: Get all teams
app.get('/api/admin/teams', requireAdmin, (req, res) => {
  const teams = db.teams.map(team => {
    const teamSubmissions = db.submissions.filter(s => s.team_id === team.id);
    return {
      ...team,
      total_points: teamSubmissions.reduce((sum, s) => sum + s.points_awarded, 0),
      challenges_solved: teamSubmissions.length
    };
  });
  res.json(teams);
});

// Admin: Delete team
app.delete('/api/admin/teams/:id', requireAdmin, (req, res) => {
  db.submissions = db.submissions.filter(s => s.team_id !== req.params.id);
  db.hintUnlocks = db.hintUnlocks.filter(h => h.team_id !== req.params.id);
  db.teams = db.teams.filter(t => t.id !== req.params.id);
  
  saveDB(dbFiles.submissions, db.submissions);
  saveDB(dbFiles.hintUnlocks, db.hintUnlocks);
  saveDB(dbFiles.teams, db.teams);
  
  res.json({ success: true });
});

// Admin: Reset all data
app.post('/api/admin/reset', requireAdmin, (req, res) => {
  db.submissions = [];
  db.hintUnlocks = [];
  db.teams = [];
  
  saveDB(dbFiles.submissions, db.submissions);
  saveDB(dbFiles.hintUnlocks, db.hintUnlocks);
  saveDB(dbFiles.teams, db.teams);
  
  res.json({ success: true });
});

// Admin: Migrate existing plain-text flags to hashed flags
app.post('/api/admin/migrate-flags', requireAdmin, (req, res) => {
  let migratedCount = 0;
  let alreadySecure = 0;

  db.challenges = db.challenges.map(challenge => {
    if (challenge.flag && !challenge.flagHash) {
      // Has plain text flag, needs migration
      const updated = {
        ...challenge,
        flagHash: hashFlag(challenge.flag)
      };
      delete updated.flag; // Remove plain text flag
      migratedCount++;
      return updated;
    } else if (challenge.flagHash) {
      alreadySecure++;
      return challenge;
    }
    return challenge;
  });

  saveDB(dbFiles.challenges, db.challenges);

  res.json({ 
    success: true, 
    migratedCount,
    alreadySecure,
    message: `Migradas ${migratedCount} flags. ${alreadySecure} ya estaban seguras.`
  });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                  CTF PLATFORM                             ║
╠═══════════════════════════════════════════════════════════╣
║  URL:    http://localhost:${PORT}                            ║
║  Admin:  http://localhost:${PORT} (click Admin Login)        ║
║  User:   admin                                            ║
║  Pass:   CTF@dm1n!2026$SecurePwd                          ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
