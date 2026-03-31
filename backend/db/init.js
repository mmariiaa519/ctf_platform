module.exports = (db) => {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      points INTEGER NOT NULL,
      description TEXT NOT NULL,
      flag TEXT NOT NULL,
      hint TEXT,
      hint_cost INTEGER DEFAULT 50,
      order_index INTEGER NOT NULL UNIQUE,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      challenge_id INTEGER NOT NULL,
      correct INTEGER NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id)
    );

    CREATE TABLE IF NOT EXISTS hint_unlocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      challenge_id INTEGER NOT NULL,
      cost INTEGER NOT NULL DEFAULT 50,
      unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_id, challenge_id),
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id)
    );

    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_name TEXT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      challenge_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Default settings
  const seedSettings = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  seedSettings.run('timer_duration', '7200');
  seedSettings.run('ctf_active', '0');
  seedSettings.run('ctf_end_time', '0');

  // Seed challenges on first run
  const count = db.prepare('SELECT COUNT(*) as n FROM challenges').get();
  if (count.n > 0) return;

  const insert = db.prepare(
    'INSERT INTO challenges (name, category, points, description, flag, hint, hint_cost, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const challenges = [
    ['Superficie expuesta', 'RECON', 100,
      'Un primer contacto con la infraestructura revela que no todo está tan oculto como debería. El servicio FTP del buque esconde más de lo que aparenta.',
      'F14G{EST4_ES_TU_PR1MER4_F14G}',
      'Revisa los puertos abiertos con un escáner básico. El FTP anónimo puede ser tu punto de entrada.', 50, 1],

    ['La primera grieta', 'INTRUSION', 100,
      'Algunos accesos parecen más resistentes de lo que realmente son. Un usuario con credenciales débiles permite la primera brecha en el perímetro.',
      'F14G{Segunda_bandera}',
      'Los usuarios con contraseñas por defecto son el eslabón más débil. Prueba ataques de diccionario.', 50, 2],

    ['Lo que no se ve', 'FORENSICS', 300,
      'Los planos del buque ocultan información clasificada. No toda la inteligencia es visible a simple vista — a veces hay que escuchar.',
      'F14G{SPECTRO_HIDDEN_MESSAGE}',
      'La esteganografía puede ocultarse en archivos de audio. Herramientas como Sonic Visualiser revelan lo invisible.', 50, 3],

    ['Mensajes internos', 'SIGINT', 300,
      'Las comunicaciones internas del buque contienen información sobre rutas de navegación clasificadas. Interceptar estos mensajes es crítico.',
      'F14G{SMTP_BACKUP_INTERCEPTED}',
      'Los backups de correo sin cifrar contienen mensajes sensibles. Busca en los logs del servidor SMTP.', 50, 4],

    ['Un nivel más arriba', 'PRIVESC', 500,
      'Tener acceso no siempre es suficiente. Una mala configuración de permisos permite ir más allá de los límites establecidos.',
      'FLAG{SYSTEMD_SUDO_REUSE_PASS}',
      'sudo -l es tu mejor amigo. Busca binarios con permisos SUID o entradas de sudoers mal configuradas.', 50, 5],

    ['Dejar huella', 'PERSISTENCE', 500,
      'El verdadero reto no es solo entrar, sino permanecer. Un acceso estable asegura el control incluso tras cambios en el sistema.',
      'FLAG{FALSE_POSITIVE_PERSISTENCE_SURVIVES_REBOOT}',
      'Los servicios de systemd y crontabs son mecanismos habituales de persistencia. Revisa también las claves SSH autorizadas.', 50, 6],

    ['El secreto mejor guardado', 'CRYPTO', 1000,
      'La información más crítica del buque está protegida por múltiples capas de seguridad. Solo los más persistentes accederán al vault clasificado.',
      'F14G{GPG_VAULT_MASTER_KEY_CRACKED}',
      'Los vaults GPG con claves débiles son vulnerables a fuerza bruta. John the Ripper puede ayudarte.', 50, 7],
  ];

  for (const c of challenges) insert.run(...c);
};
