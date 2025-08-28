import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Simple config
const ADMIN_KEY = process.env.ADMIN_KEY || '1738';

// Init DB
const dbFile = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS balances (
    uid TEXT PRIMARY KEY,
    balance_usd REAL NOT NULL DEFAULT 0,
    updated_at INTEGER,
    FOREIGN KEY(uid) REFERENCES users(uid)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    amount_usd REAL NOT NULL,
    note TEXT,
    created_at INTEGER,
    FOREIGN KEY(uid) REFERENCES users(uid)
  )`);
});

// Helpers
function getNow() { return Date.now(); }

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err){
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function(err, row){
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// Routes
// Upsert user registration
app.post('/api/register', async (req, res) => {
  try {
    const { uid, email, name } = req.body || {};
    if (!uid) return res.status(400).json({ error: 'uid is required' });
    await run(`INSERT INTO users(uid, email, name, created_at) VALUES(?,?,?,?)
              ON CONFLICT(uid) DO UPDATE SET email=excluded.email, name=excluded.name`,
      [uid, email || null, name || null, getNow()]);
    await run(`INSERT INTO balances(uid, balance_usd, updated_at) VALUES(?,?,?)
              ON CONFLICT(uid) DO NOTHING`, [uid, 0, getNow()]);
    const profile = await get(`SELECT u.uid, u.email, u.name, IFNULL(b.balance_usd, 0) as balance_usd
                               FROM users u LEFT JOIN balances b ON b.uid=u.uid WHERE u.uid=?`, [uid]);
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: 'internal_error', detail: String(e?.message || e) });
  }
});

// Get profile by uid
app.get('/api/profile/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const profile = await get(`SELECT u.uid, u.email, u.name, IFNULL(b.balance_usd, 0) as balance_usd
                               FROM users u LEFT JOIN balances b ON b.uid=u.uid WHERE u.uid=?`, [uid]);
    if (!profile) return res.status(404).json({ error: 'not_found' });
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: 'internal_error', detail: String(e?.message || e) });
  }
});

// Manual deposit (admin-only)
app.post('/api/deposits/manual', async (req, res) => {
  try {
    const key = req.header('x-admin-key');
    if (key !== ADMIN_KEY) return res.status(401).json({ error: 'unauthorized' });
    const { uid, amountUsd, note } = req.body || {};
    const amount = Number(amountUsd);
    if (!uid || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'invalid_params' });
    const user = await get(`SELECT uid FROM users WHERE uid=?`, [uid]);
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    await run(`INSERT INTO deposits(uid, amount_usd, note, created_at) VALUES(?,?,?,?)`, [uid, amount, note || null, getNow()]);
    await run(`INSERT INTO balances(uid, balance_usd, updated_at) VALUES(?,?,?)
               ON CONFLICT(uid) DO UPDATE SET balance_usd = balance_usd + excluded.balance_usd, updated_at=excluded.updated_at`,
      [uid, amount, getNow()]);
    const profile = await get(`SELECT u.uid, u.email, u.name, IFNULL(b.balance_usd, 0) as balance_usd
                               FROM users u LEFT JOIN balances b ON b.uid=u.uid WHERE u.uid=?`, [uid]);
    res.json({ ok: true, profile });
  } catch (e) {
    res.status(500).json({ error: 'internal_error', detail: String(e?.message || e) });
  }
});

// Serve static site for convenience
app.use('/', express.static(__dirname));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Watchers Eye API running on http://localhost:${PORT}`);
});


