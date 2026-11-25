// EarnPro single-file backend (Node.js built-ins only)
// Setup:
//   1) Put this file beside your index.html
//   2) Install Node.js 18+
//   3) Set ADMIN_PASSWORD to a strong password
//      Linux/macOS: ADMIN_PASSWORD='your-strong-password' node server.js
//      Windows PowerShell: $env:ADMIN_PASSWORD='your-strong-password'; node server.js
//   4) Open http://localhost:3000
//
// IMPORTANT: This is a starter backend. The browser's ad-completion callback can be
// forged by a user. Do NOT pay real money based only on /api/reward. Before launch,
// integrate the ad network's server-to-server postback/verification and HTTPS hosting.

'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'androidsujon';
const DB_FILE = path.join(__dirname, 'earnpro-data.json');
const DAILY_LIMIT = 20;
const REWARD_RATE = 2.50;
const MIN_WITHDRAW = 100;
const MAX_BODY = 32 * 1024;

if (!process.env.ADMIN_PASSWORD) {
  console.warn('TEST MODE: default admin password is androidsujon. Change it before any public/real-money use.');
}

let db = { users: {}, withdrawals: [] };
try {
  if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} catch (e) {
  console.error('Could not read earnpro-data.json:', e.message);
  process.exit(1);
}
function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}
function send(res, status, data, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > MAX_BODY) { reject(new Error('অনুরোধটি অনেক বড়')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error('ভুল JSON')); }
    });
    req.on('error', reject);
  });
}
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, saved) {
  const actual = crypto.scryptSync(password, saved.salt, 64);
  const expected = Buffer.from(saved.hash, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}
function token() { return crypto.randomBytes(32).toString('hex'); }
function todayKey() {
  // Reset based on Bangladesh time (UTC+6).
  return new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function getUser(req) {
  const t = req.headers['x-token'];
  if (!t) return null;
  return Object.values(db.users).find(u => u.token === t) || null;
}
function userView(u) {
  const day = todayKey();
  if (u.day !== day) { u.day = day; u.done = 0; save(); }
  return { phone: u.phone, bal: Number(u.bal.toFixed(2)), done: u.done,
    daily: DAILY_LIMIT, rate: REWARD_RATE, history: db.withdrawals
      .filter(w => w.phone === u.phone).sort((a,b) => b.time-a.time)
      .map(w => ({ method:w.method, number:w.number, amount:w.amount, status:w.status, time:w.time })) };
}
function adminOk(req) {
  const supplied = String(req.headers['x-admin'] || '');
  const a = Buffer.from(supplied), b = Buffer.from(ADMIN_PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function validPhone(s) { return /^01[3-9]\d{8}$/.test(String(s || '')); }
function routePath(url) { return new URL(url, 'http://localhost').pathname; }

const server = http.createServer(async (req, res) => {
  // Serve the uploaded frontend from the same folder.
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const file = path.join(__dirname, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404, {'content-type':'text/plain; charset=utf-8'});
      return res.end('index.html ফাইলটি server.js-এর পাশে রাখুন।');
    }
    res.writeHead(200, {'content-type':'text/html; charset=utf-8', 'x-content-type-options':'nosniff'});
    return fs.createReadStream(file).pipe(res);
  }

  const p = routePath(req.url);
  if (!p.startsWith('/api/')) return send(res, 404, { error:'পাওয়া যায়নি' });

  try {
    if (req.method === 'POST' && (p === '/api/register' || p === '/api/login')) {
      const b = await readBody(req);
      const phone = String(b.phone || '').trim();
      const password = String(b.password || '');
      if (!validPhone(phone)) return send(res, 400, {error:'সঠিক ১১ সংখ্যার বাংলাদেশি মোবাইল নম্বর দিন'});
      if (password.length < 6 || password.length > 128) return send(res, 400, {error:'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে'});
      let u = db.users[phone];
      if (p === '/api/register') {
        if (u) return send(res, 409, {error:'এই নম্বরে অ্যাকাউন্ট আছে'});
        const pw = hashPassword(password);
        u = db.users[phone] = { phone, ...pw, token:'', bal:0, done:0, day:todayKey() };
      } else {
        if (!u || !verifyPassword(password, u)) return send(res, 401, {error:'মোবাইল নম্বর বা পাসওয়ার্ড ভুল'});
      }
      u.token = token(); save();
      return send(res, 200, { token:u.token });
    }

    if (req.method === 'GET' && p === '/api/me') {
      const u = getUser(req);
      if (!u) return send(res, 401, {error:'আবার লগইন করুন'});
      return send(res, 200, userView(u));
    }

    if (req.method === 'POST' && p === '/api/reward') {
      const u = getUser(req);
      if (!u) return send(res, 401, {error:'আবার লগইন করুন'});
      const day = todayKey();
      if (u.day !== day) { u.day = day; u.done = 0; }
      if (u.done >= DAILY_LIMIT) return send(res, 400, {error:'আজকের সব কাজ শেষ'});
      // TEST MODE ONLY: this endpoint adds demo balance without verifying an ad view. Never pay real money from this endpoint.
      u.done += 1; u.bal = Number((u.bal + REWARD_RATE).toFixed(2)); save();
      return send(res, 200, userView(u));
    }

    if (req.method === 'POST' && p === '/api/withdraw') {
      const u = getUser(req);
      if (!u) return send(res, 401, {error:'আবার লগইন করুন'});
      const b = await readBody(req);
      const method = String(b.method || '');
      const number = String(b.number || '').trim();
      const amount = Number(b.amount);
      if (!['বিকাশ','নগদ','রকেট'].includes(method)) return send(res, 400, {error:'পেমেন্ট মাধ্যম নির্বাচন করুন'});
      if (!validPhone(number)) return send(res, 400, {error:'সঠিক ১১ সংখ্যার নম্বর দিন'});
      if (!Number.isFinite(amount) || amount < MIN_WITHDRAW || Math.round(amount*100)!==amount*100)
        return send(res, 400, {error:'সর্বনিম্ন উত্তোলন ৳১০০'});
      if (amount > u.bal) return send(res, 400, {error:'পর্যাপ্ত ব্যালেন্স নেই'});
      const w = { id:crypto.randomBytes(12).toString('hex'), phone:u.phone, method, number,
        amount, status:'pending', time:Date.now() };
      u.bal = Number((u.bal - amount).toFixed(2));
      db.withdrawals.push(w); save();
      return send(res, 200, userView(u));
    }

    if (p.startsWith('/api/admin/')) {
      if (!adminOk(req)) return send(res, 401, {error:'অ্যাডমিন পাসওয়ার্ড ভুল'});
      if (req.method === 'GET' && p === '/api/admin/withdrawals')
        return send(res, 200, db.withdrawals.slice().sort((a,b)=>b.time-a.time));
      const match = p.match(/^\/api\/admin\/withdrawals\/([a-f0-9]+)$/);
      if (req.method === 'POST' && match) {
        const w = db.withdrawals.find(x => x.id === match[1]);
        if (!w) return send(res, 404, {error:'রিকোয়েস্ট পাওয়া যায়নি'});
        if (w.status !== 'pending') return send(res, 400, {error:'এই রিকোয়েস্ট আগে প্রসেস করা হয়েছে'});
        const b = await readBody(req);
        if (b.action === 'paid') w.status = 'paid';
        else if (b.action === 'rejected') {
          w.status = 'rejected';
          const u = db.users[w.phone];
          if (u) u.bal = Number((u.bal + w.amount).toFixed(2));
        } else return send(res, 400, {error:'ভুল অ্যাকশন'});
        save(); return send(res, 200, {ok:true});
      }
    }

    return send(res, 404, {error:'API পাওয়া যায়নি'});
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, {error:e.message || 'সার্ভার সমস্যা'});
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`EarnPro চালু: http://localhost:${PORT}`);
});
