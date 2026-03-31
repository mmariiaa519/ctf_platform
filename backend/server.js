const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3001;

// DB setup
const DB_DIR = path.join(__dirname, 'db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(path.join(DB_DIR, 'marsec.db'));
require('./db/init')(db);

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth')(db));
app.use('/api/challenges', require('./routes/challenges')(db));
app.use('/api/scoreboard', require('./routes/scoreboard')(db));
app.use('/api/admin', require('./routes/admin')(db));

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`MARSEC CTF Backend — puerto ${PORT}`);
});
