const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const app = express();
app.use(cors());
app.use(express.json());

// ── Google Sheets Config ──────────────────────────────────────────────────────
const SHEET_ID = '1eoe9kqiRtOLmYT0RHhbfxC-Wvnx5DS9z2gofSY5XfXg';
const CLIENT_EMAIL = 'dashboard-writer@student-dashboard-497008.iam.gserviceaccount.com';
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQD7TrARRqULj2Mh
/LJB+CaHGhrlHkY76GZynibX8JKQVqVj4QC3Kc+vqcUkYzrXZ7dq0T3m29YxD6yN
ZCRXKmiJvmVHDJHhcVzl/xgPvWVw+ESKNAOBmaagVsvtrrmJSHxls+zNaWoukfqU
tasov0VuDHZaEX2oz4oBXwPrjWHdJGeGVSeRiwAfdVrtABD/0FJZJeFJKx82HCJE
+UHBG1V6agyYWVAaG/8IRL6HNBsPpIjBcF+b6PYNZCRhSskNFSFhoVppiLbXvG/U
gwELZ15mc/zBptJ2SIITFfafSqlMhThFBMeiz29MA1pEUlqxZtC/29wawRifpMn7
0vvbTFBzAgMBAAECggEAHciCl1mO/+K7dfCz05usPUC7xUGkQz9UvOq/YcIyLIcI
TOECq7J52bC+G4TjGVpCY5duxahyJxhbc9pVcDsnboOxDw2PUG+V+fAUkvD4T74s
qVBmxfpGxCPlQUL+3CVKEOeU/fcrTV+hmfQ517drbBJwCFagVNxb17PCDC2SVpnY
x+QT/tEI/dezuegUh8OoO0sw8/l72pfhJG7qW7eNWTwHtWoIUYANUfOAxUogBBEu
kslSJUjPuXaRpJHnDu08WIV33CzljnTqNi72hGsrctIX0ADTlDz+/4udiF5tOQJU
DHiuxlPhEandRCwXGQkBfv7RzvbvXCrFrfMnEFyxcQKBgQD+/5lDfdJUvtRewziU
xQweJacm0VOMNFSeXoGetbunh4zuulhzZagrR42asrlNFbScNGh1s0mhCuqgqRJ8
Yw04NJypYOn5Yi+lCwOVxbYZ+fKkiTteGKgsSDPdccwJBO+koqyQx82bLFPYfxOq
8VqXX9H/zULX6PKKzybjk1epqQKBgQD8S2CxyJrH9TCBw0e304eXNuivwCy/mWdp
p2FMAmDuB6YkLk1nanH0US9JxhRjT8InjN6d+2DGFhN//ZUo8PN3eNUVtIOn5Een
L+YIgvmvR8UfVA1VrYkGTuaLnX5xGXz0JcPJl8e9dl9ZwYI2a6JF9z+XfUsndoTV
QBdYmhmSuwKBgFKmkgy4KYZiW/9jE2HVBHp5BdalHolhJNQ4GZdRnENOwjVWnPi6
SGnOxW0Q5NLBaEsBCaKsu/7AxQ/R/TXn/Q7srqKP0QaN9pduHHldHgsJYsZF3MJB
B7Firbzm95Uszmf0ei5rNI9JLNwNRFix5gUOf8iDxViqHoMzZY154n4RAoGAejny
YG71PYY1t8fpiM870zBQzkRl6XTiOrdSVcaZOvgNr12XNlDFYD2skSsbWXmccBi5
CQRtv8mWLN2nU6xX5zts0BUh60aWyBJWeS0q1ZYJk8Heq/Fkft/epSjpxtU4Sfe5
wIJ9y/X6/7rV4JOIjCjacAPNUxMCC2X/aXdOiF0CgYAeS5pcwctP0RBo/A/IZVcs
LNTq0Yv6Wqv/57bi9PgWlQuLAXwZEuFqmuQ/2kpdwc9dD1rlR6U9Sgxr1cukukTY
TE3u/OGhKSUQlk+mRAGHG+QBo3iICgFpsloADPGUF8aGauh3+KxrJWKOnTdCavH5
1xp2F7AJxCRF1/kz0OVZ0w==
-----END PRIVATE KEY-----`;

// ── Google Auth ───────────────────────────────────────────────────────────────
async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now
  })).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(header + '.' + payload);
  const sig = sign.sign(PRIVATE_KEY, 'base64url');
  const jwt = header + '.' + payload + '.' + sig;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt
  });
  const json = await res.json();
  if (!json.access_token) throw new Error('Token error: ' + JSON.stringify(json));
  return json.access_token;
}

// ── Sheets helpers ────────────────────────────────────────────────────────────
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID;

async function ensureSheet(token, name, headers) {
  const r = await fetch(SHEETS_BASE, { headers: { Authorization: 'Bearer ' + token } });
  const meta = await r.json();
  const exists = (meta.sheets || []).some(s => s.properties.title === name);
  if (!exists) {
    await fetch(SHEETS_BASE + ':batchUpdate', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: name } } }] })
    });
    await appendRow(token, name, headers);
  }
}

async function appendRow(token, sheet, values) {
  await fetch(SHEETS_BASE + '/values/' + encodeURIComponent(sheet) + '!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] })
  });
}

async function readSheet(token, sheet) {
  const r = await fetch(SHEETS_BASE + '/values/' + encodeURIComponent(sheet), {
    headers: { Authorization: 'Bearer ' + token }
  });
  const json = await r.json();
  const rows = json.values || [];
  if (!rows.length) return [];

  // Use fixed column positions - no header row in sheet
  if (sheet === 'Task Completions') {
    return rows.map(row => ({
      Timestamp: row[0]||'', Student: row[1]||'', Week: row[2]||'',
      Theme: row[3]||'', Task: row[4]||'', Category: row[5]||'', Completed: row[6]||''
    })).filter(r => r.Student && r.Student !== 'Student');
  } else if (sheet === 'Journal Entries') {
    return rows.map(row => ({
      Timestamp: row[0]||'', Student: row[1]||'', Week: row[2]||'',
      Theme: row[3]||'', Text: row[4]||'', WordCount: row[5]||0
    })).filter(r => r.Student && r.Student !== 'Student');
  } else if (sheet === 'Vocab Activity') {
    return rows.map(row => ({
      Timestamp: row[0]||'', Student: row[1]||'', Week: row[2]||'',
      Word: row[3]||'', Action: row[4]||''
    })).filter(r => r.Student && r.Student !== 'Student');
  } else if (sheet === 'Feedback') {
    return rows.map(row => ({
      Timestamp: row[0]||'', Student: row[1]||'', Week: row[2]||'',
      EntryIndex: row[3]||'', FeedbackText: row[4]||'', Grade: row[5]||'', Published: row[6]||''
    })).filter(r => r.Student && r.Student !== 'Student');
  }
  return [];
}

// ── API: receive student data ─────────────────────────────────────────────────
app.post('/api/log', async (req, res) => {
  try {
    const d = req.body;
    if (!d || !d.student || !d.type) return res.status(400).json({ error: 'Missing fields' });
    const token = await getToken();
    const ts = new Date().toLocaleString('en-GB');
    if (d.type === 'task') {
      await ensureSheet(token, 'Task Completions', ['Timestamp','Student','Week','Theme','Task','Category','Completed']);
      await appendRow(token, 'Task Completions', [ts, d.student, 'Week '+d.week, d.weekTheme||'', d.taskTitle||'', d.category||'', d.completed ? 'Completed' : 'Uncompleted']);
    } else if (d.type === 'journal') {
      await ensureSheet(token, 'Journal Entries', ['Timestamp','Student','Week','Theme','Text','WordCount']);
      await appendRow(token, 'Journal Entries', [ts, d.student, 'Week '+d.week, d.weekTheme||'', d.text||'', d.wordCount||0]);
    } else if (d.type === 'vocab') {
      await ensureSheet(token, 'Vocab Activity', ['Timestamp','Student','Week','Word','Action']);
      await appendRow(token, 'Vocab Activity', [ts, d.student, 'Week '+d.week, d.word||'', d.action||'']);
    }
    res.json({ status: 'ok', student: d.student, type: d.type });
  } catch (e) {
    console.error('POST /api/log error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── API: read all data ────────────────────────────────────────────────────────
app.get('/api/data', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const token = await getToken();
    const [tasks, journals, vocab] = await Promise.all([
      readSheet(token, 'Task Completions').catch(() => []),
      readSheet(token, 'Journal Entries').catch(() => []),
      readSheet(token, 'Vocab Activity').catch(() => [])
    ]);
    res.json({ tasks, journals, vocab });
  } catch (e) {
    console.error('GET /api/data error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Save teacher feedback ────────────────────────────────────────────────────
app.post('/api/feedback', async (req, res) => {
  try {
    const d = req.body;
    if (!d.student || !d.week) return res.status(400).json({ error: 'Missing fields' });
    const token = await getToken();
    await ensureSheet(token, 'Feedback', ['Timestamp','Student','Week','EntryIndex','FeedbackText','Grade','Published']);
    const ts = new Date().toLocaleString('en-GB');
    await appendRow(token, 'Feedback', [ts, d.student, d.week, String(d.entryIndex||0), d.feedbackText||'', d.grade||'', d.published?'Yes':'No']);
    res.json({ status: 'ok' });
  } catch(e) {
    console.error('POST /api/feedback error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Get feedback for a student ────────────────────────────────────────────────
app.get('/api/feedback/:student', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const token = await getToken();
    const all = await readSheet(token, 'Feedback').catch(() => []);
    const student = decodeURIComponent(req.params.student);
    const feedback = all.filter(r => r.Student === student && r.Published === 'Yes');
    res.json({ feedback });
  } catch(e) {
    console.error('GET /api/feedback error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Get ALL feedback (for teacher dashboard) ──────────────────────────────────
app.get('/api/feedback', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const token = await getToken();
    const feedback = await readSheet(token, 'Feedback').catch(() => []);
    res.json({ feedback });
  } catch(e) {
    console.error('GET /api/feedback error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Student page ──────────────────────────────────────────────────────────────
app.get('/student/:slug', (req, res) => {
  const slug = req.params.slug;
  const name = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  res.setHeader('Content-Type', 'text/html');
  res.send(studentPage(name));
});

// ── Teacher dashboard ─────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(dashboardPage());
});

// ── Student page HTML ─────────────────────────────────────────────────────────
function studentPage(studentName) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${studentName} — Summer English Programme 2026</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f4f8;min-height:100vh}
.nav{background:linear-gradient(135deg,#1A5276 0%,#0E6655 100%);padding:0 0 0 0;position:sticky;top:0;z-index:100}
.nav-top{padding:0.9rem 1.25rem 0}
.nav-top h1{font-size:17px;font-weight:600;color:#fff;margin-bottom:1px}
.nav-top p{font-size:11px;color:rgba(255,255,255,0.72);margin-bottom:0.6rem}
.tabs{display:flex;border-top:1px solid rgba(255,255,255,0.15)}
.tab-btn{flex:1;padding:0.6rem 0.25rem;font-size:13px;font-weight:500;color:rgba(255,255,255,0.6);background:none;border:none;cursor:pointer;border-bottom:3px solid transparent}
.tab-btn.active{color:#fff;border-bottom-color:#fff}
.page{display:none;padding:1.1rem;max-width:760px;margin:0 auto;padding-bottom:3rem}
.page.active{display:block}
.stats-bar{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:1rem}
.stat-card{background:#fff;border-radius:10px;padding:0.65rem;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
.stat-val{font-size:24px;font-weight:700;color:#1A5276;display:block}
.stat-lbl{font-size:11px;color:#888;margin-top:1px;display:block}
.prog-wrap{background:#e0e6ed;border-radius:99px;height:8px;margin-bottom:1.1rem;overflow:hidden}
.prog-fill{height:8px;border-radius:99px;background:linear-gradient(90deg,#1A5276,#0E6655);transition:width 0.4s}
.motiv{background:#fff;border-radius:10px;padding:0.85rem 1rem;margin-bottom:1rem;border-left:4px solid #1A5276;font-size:13px;color:#555;line-height:1.6}
.motiv strong{color:#1A5276}
.week-card{background:#fff;border-radius:12px;margin-bottom:9px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
.week-hdr{display:flex;align-items:center;justify-content:space-between;padding:0.8rem 1rem;cursor:pointer;user-select:none}
.week-hdr:hover{background:#f8f9fa}
.wh-left{display:flex;align-items:center;gap:9px}
.wdot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.wname{font-size:13px;font-weight:600;color:#1a1a2e}
.wdates{font-size:11px;color:#999;margin-top:1px}
.wh-right{display:flex;align-items:center;gap:7px}
.wbadge{font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px}
.wchev{font-size:17px;color:#ccc;transition:transform 0.2s}
.wchev.open{transform:rotate(180deg)}
.minibar-wrap{height:3px;background:#f0f0f0}
.minibar{height:3px;transition:width 0.3s}
.week-body{display:none;border-top:1px solid #f0f0f0}
.week-body.open{display:block}
.week-focus{font-size:11px;color:#777;padding:0.5rem 1rem;background:#fafafa;border-bottom:1px solid #f0f0f0;font-style:italic}
.task{display:flex;align-items:flex-start;gap:9px;padding:9px 1rem;border-bottom:1px solid #f8f8f8;cursor:pointer;-webkit-tap-highlight-color:transparent}
.task:last-child{border-bottom:none}
.task:hover{background:#fafafa}
.cb{width:19px;height:19px;border-radius:5px;border:2px solid #d0d0d0;flex-shrink:0;margin-top:3px;display:flex;align-items:center;justify-content:center;background:#fff;transition:all 0.15s}
.cb.done{background:#1A5276;border-color:#1A5276}
.cb svg{display:none;width:10px;height:10px}
.cb.done svg{display:block}
.task-right{flex:1;display:flex;flex-direction:column;gap:4px}
.task-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cat-tag{font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:2px 6px;border-radius:4px;white-space:nowrap}
.cat-reading{background:#D6EAF8;color:#1A5276}
.cat-writing{background:#F4ECF7;color:#6C3483}
.cat-grammar{background:#D1F2EB;color:#0E6655}
.cat-vocab{background:#FDEBD0;color:#BA4A00}
.task-title{font-size:13px;font-weight:600;color:#1a1a2e;line-height:1.4}
.task-title.done{color:#bbb;text-decoration:line-through}
.task-detail{font-size:12px;color:#888;line-height:1.5}
.task-detail.done{color:#ccc;text-decoration:line-through}
.task-link{display:inline-block;margin-top:5px;font-size:11px;font-weight:600;color:#1A5276;text-decoration:none;padding:3px 9px;border:1px solid #D6EAF8;border-radius:5px;background:#f0f6fc}
.task-link:hover{background:#D6EAF8}
.page-footer{text-align:center;margin-top:1.5rem}
.reset-btn{background:none;border:1px solid #ddd;border-radius:8px;padding:5px 14px;font-size:12px;color:#aaa;cursor:pointer}
.footer-note{font-size:11px;color:#ccc;margin-top:8px}
.week-select{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:1rem}
.ws-btn{padding:5px 11px;font-size:11px;font-weight:500;border-radius:99px;border:1.5px solid #ddd;background:#fff;cursor:pointer;color:#555}
.ws-btn.ja{background:#1A5276;border-color:#1A5276;color:#fff}
.ws-btn.va{background:#BA4A00;border-color:#BA4A00;color:#fff}
.panel{background:#fff;border-radius:12px;padding:1.1rem;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
.j-prompt{font-size:12px;color:#777;font-style:italic;margin-bottom:0.75rem;padding:0.6rem 0.85rem;background:#f8f9fa;border-radius:8px;border-left:3px solid #1A5276;line-height:1.6}
.j-prompt strong{color:#1A5276;font-style:normal}
.j-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem}
.j-wc{font-size:11px;color:#aaa}
textarea.j-input{width:100%;min-height:200px;border:1.5px solid #e0e6ed;border-radius:8px;padding:0.75rem;font-size:13px;font-family:inherit;color:#333;line-height:1.7;resize:vertical;outline:none}
textarea.j-input:focus{border-color:#1A5276}
.j-save-row{display:flex;justify-content:space-between;align-items:center;margin-top:0.6rem}
.save-btn{padding:7px 18px;background:#1A5276;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
.saved-msg{font-size:11px;color:#0E6655;opacity:0;transition:opacity 0.3s}
.saved-msg.show{opacity:1}
.j-history{margin-top:1.1rem}
.j-hist-lbl{font-size:11px;font-weight:600;color:#ccc;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem}
.j-entry{background:#f8f9fa;border-radius:8px;padding:0.65rem 0.85rem;margin-bottom:7px;border-left:3px solid #e0e6ed}
.j-entry-date{font-size:10px;color:#bbb;margin-bottom:3px}
.j-entry-text{font-size:12px;color:#555;line-height:1.6;white-space:pre-wrap;max-height:72px;overflow:hidden}
.j-entry-text.exp{max-height:none}
.j-exp{font-size:11px;color:#1A5276;cursor:pointer;margin-top:3px;display:inline-block}
.q-box{background:#fff9f0;border:1.5px solid #FDEBD0;border-radius:10px;padding:0.75rem 1rem;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.q-text{font-size:12px;color:#777}
.q-text strong{color:#BA4A00}
.q-btn{padding:5px 14px;background:#BA4A00;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;text-decoration:none}
.v-controls{display:flex;gap:8px;margin-bottom:1rem}
.v-mode{padding:5px 14px;font-size:12px;font-weight:500;border-radius:8px;border:1.5px solid #ddd;background:#fff;cursor:pointer;color:#555}
.v-mode.active{background:#BA4A00;border-color:#BA4A00;color:#fff}
.flashcard{min-height:175px;background:linear-gradient(135deg,#1A5276 0%,#0E6655 100%);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5rem;text-align:center;cursor:pointer;margin-bottom:1rem;user-select:none}
.fc-word{font-size:26px;font-weight:700;color:#fff;margin-bottom:6px}
.fc-hint{font-size:12px;color:rgba(255,255,255,0.55)}
.fc-def{font-size:14px;color:#fff;line-height:1.6;display:none}
.flashcard.flipped .fc-word,.flashcard.flipped .fc-hint{display:none}
.flashcard.flipped .fc-def{display:block}
.fc-nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}
.fc-nav-btn{padding:6px 16px;font-size:12px;font-weight:600;border-radius:8px;border:1.5px solid #ddd;background:#fff;cursor:pointer;color:#555}
.fc-counter{font-size:12px;color:#aaa}
.word-list{display:flex;flex-direction:column}
.word-row{display:flex;padding:8px 0;border-bottom:1px solid #f0f0f0;gap:12px}
.word-row:last-child{border-bottom:none}
.word-term{font-size:13px;font-weight:600;color:#1A5276;min-width:120px;flex-shrink:0}
.word-def{font-size:13px;color:#555;line-height:1.5}
.vocab-all-note{background:#FFF9F0;border:1.5px solid #FDEBD0;border-radius:10px;padding:0.85rem 1rem;margin-bottom:1rem;font-size:13px;color:#777;line-height:1.6}
.vocab-all-note strong{color:#BA4A00}
.fb-received{margin-top:0.85rem;padding:0.85rem 1rem;background:linear-gradient(135deg,#f0f7ff,#f0fdf7);border-radius:8px;border-left:4px solid #1A5276}
.fb-received-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem}
.fb-received-label{font-size:11px;font-weight:700;color:#1A5276;text-transform:uppercase;letter-spacing:0.05em}
.fb-received-grade{font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px}
.grade-excellent{background:#D1F2EB;color:#0E6655}
.grade-good{background:#D6EAF8;color:#1A5276}
.grade-developing{background:#FCF3CF;color:#7D6608}
.fb-received-text{font-size:13px;color:#333;line-height:1.7}
</style>
</head>
<body>
<div class="nav">
  <div class="nav-top">
    <h1>${studentName} — Summer English Programme 2026</h1>
    <p>28 May – 17 August &nbsp;·&nbsp; Your complete programme in one place</p>
  </div>
  <div class="tabs">
    <button class="tab-btn active" onclick="showTab('tracker')">Tracker</button>
    <button class="tab-btn" onclick="showTab('journal')">Journal</button>
    <button class="tab-btn" onclick="showTab('vocab')">Vocabulary</button>
  </div>
</div>
<div class="page active" id="tab-tracker">
  <div class="stats-bar">
    <div class="stat-card"><span class="stat-val" id="s-done">0</span><span class="stat-lbl">Tasks done</span></div>
    <div class="stat-card"><span class="stat-val" id="s-total">0</span><span class="stat-lbl">Total tasks</span></div>
    <div class="stat-card"><span class="stat-val" id="s-pct">0%</span><span class="stat-lbl">Complete</span></div>
  </div>
  <div class="prog-wrap"><div class="prog-fill" id="main-bar" style="width:0%"></div></div>
  <div class="motiv" id="motivebox"><strong>Hey ${studentName}</strong> — tap a week to get started. Every small step counts.</div>
  <div id="weeks-container"></div>
  <div class="page-footer">
    <button class="reset-btn" onclick="resetTracker()">Reset all progress</button>
    <div class="footer-note">Your progress saves on this device.</div>
  </div>
</div>
<div class="page" id="tab-journal">
  <div class="week-select" id="j-week-btns"></div>
  <div class="panel">
    <div class="j-prompt" id="j-prompt"></div>
    <div class="j-meta"><span id="j-label" style="font-size:12px;color:#aaa"></span><span class="j-wc" id="j-wc">0 words</span></div>
    <textarea class="j-input" id="j-textarea" placeholder="Start writing here..."></textarea>
    <div class="j-save-row">
      <button class="save-btn" onclick="saveJournal()">Save entry</button>
      <span class="saved-msg" id="saved-msg">Saved!</span>
    </div>
    <div class="j-history" id="j-history"></div>
  </div>
</div>
<div class="page" id="tab-vocab">
  <div class="week-select" id="v-week-btns"></div>
  <div class="panel" id="v-panel">
    <div class="q-box" id="q-box">
      <span class="q-text"><strong>Study on Quizlet</strong> — open your flashcard set for this week</span>
      <a class="q-btn" id="q-btn" href="#" target="_blank">Open Quizlet</a>
    </div>
    <div class="vocab-all-note" id="vocab-all-note" style="display:none">
      <strong>Week 12 — Final vocabulary review.</strong> Use the buttons above to go back through every week from Week 1 to Week 12.
    </div>
    <div class="v-controls">
      <button class="v-mode active" onclick="setVMode('flash')">Flashcards</button>
      <button class="v-mode" onclick="setVMode('list')">Word list</button>
    </div>
    <div id="v-flash">
      <div class="flashcard" id="flashcard" onclick="flipCard()">
        <div class="fc-word" id="fc-word"></div>
        <div class="fc-hint">Tap to reveal definition</div>
        <div class="fc-def" id="fc-def"></div>
      </div>
      <div class="fc-nav">
        <button class="fc-nav-btn" onclick="fcPrev()">Previous</button>
        <span class="fc-counter" id="fc-counter">1 / 10</span>
        <button class="fc-nav-btn" onclick="fcNext()">Next</button>
      </div>
    </div>
    <div id="v-list" style="display:none"><div class="word-list" id="word-list"></div></div>
  </div>
</div>
<script>
// ── CONFIG ────────────────────────────────────────────────────────────────────
const STUDENT_NAME = "${studentName}";
const SERVER_URL = window.location.origin + "/api/log";
const STORE_KEY = "prog_" + "${studentName}".replace(/\\s/g,"_").toLowerCase();

// ── SYNC ──────────────────────────────────────────────────────────────────────
function sync(data) {
  fetch(SERVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({}, data, { student: STUDENT_NAME }))
  }).then(r => r.json()).then(j => console.log("Synced:", j)).catch(e => console.warn("Sync failed:", e));
}

// ── LOCAL STATE ───────────────────────────────────────────────────────────────
let state = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

// ── WEEKS DATA ────────────────────────────────────────────────────────────────
const WEEKS=[{num:1,dates:"28-29 May",theme:"Getting Started",color:"#1A5276",focus:"Set up all your platforms and build your daily routine",tasks:[{cat:"reading",title:"ReadTheory - complete your placement test",detail:"Take the placement quiz. Write your starting Lexile score in your journal.",link:"https://readtheory.org",lbl:"Open ReadTheory"},{cat:"reading",title:"CommonLit - read your first free-choice passage",detail:"Go to CommonLit, browse the library, and choose any passage that interests you.",link:"https://www.commonlit.org/home",lbl:"Open CommonLit"},{cat:"grammar",title:"IXL - complete the English Diagnostic",detail:"Run the English Diagnostic. Note your three weakest skill areas in your journal.",link:"https://www.ixl.com/ela/",lbl:"Open IXL"},{cat:"grammar",title:"Khan Academy - Grammar Unit 1: Parts of speech - the noun",detail:"Open Unit 1. Watch every video and complete every exercise.",link:"https://www.khanacademy.org/ela/grammar/parts-of-speech-the-noun",lbl:"Open Khan Academy"},{cat:"vocab",title:"Quizlet - set up your account and study Week 1 word set",detail:"Log in with your school Google account. Open the Week 1 set and study using Learn mode.",link:"https://quizlet.com/vn/1181497517/week-1-academic-words-flash-cards/?i=75s0z1&x=1jqt",lbl:"Open Quizlet Set"},{cat:"writing",title:"Journal - write your summer goals",detail:"Go to the Journal tab above. Write 5 sentences about what you want to achieve this summer.",link:null,lbl:null}],journalPrompt:"Write 5 sentences about what you want to achieve this summer. What is your biggest goal for the future?",quizletLink:"https://quizlet.com/vn/1181497517/week-1-academic-words-flash-cards/?i=75s0z1&x=1jqt",vocab:[["analyse","to examine something carefully and in detail"],["identify","to recognise and name something"],["explain","to make something clear by describing it"],["describe","to give details about what something is like"],["compare","to look at two things and find similarities"],["contrast","to look at two things and find differences"],["suggest","to put forward an idea or possibility"],["respond","to reply or react to something"],["predict","to say what you think will happen"],["summarise","to give the main points briefly"]]},{num:2,dates:"1-5 Jun",theme:"Phonics and Decoding",color:"#145A32",focus:"Breaking words into parts - prefixes, suffixes, and roots",tasks:[{cat:"reading",title:'CommonLit - "The Jacket" by Gary Soto',detail:"Read carefully. Underline every unfamiliar word as you go. Answer all questions when finished.",link:"https://www.commonlit.org/students/student_lessons/25093336",lbl:"Open Passage"},{cat:"reading",title:"ReadTheory - complete 5 quizzes",detail:"Complete 5 quizzes this week. The platform chooses the right level for you automatically.",link:"https://readtheory.org",lbl:"Open ReadTheory"},{cat:"grammar",title:"Khan Academy - Grammar Unit 2: Parts of speech - the verb",detail:"Watch all videos and complete all exercises.",link:"https://www.khanacademy.org/ela/grammar/parts-of-speech-the-verb",lbl:"Open Khan Academy"},{cat:"grammar",title:"IXL - Prefixes and suffixes",detail:"Find Prefixes and suffixes in the English section. Aim for a Smart Score of 80.",link:"https://www.ixl.com/ela/grade-8/use-words-with-prefixes",lbl:"Open IXL"},{cat:"vocab",title:"Quizlet - Week 2 set: roots and affixes",detail:"Study the Week 2 set. Use Learn mode first, then Test mode by Friday.",link:"https://quizlet.com/vn/1181497860/week-2-words-about-words-flash-cards/?i=75s0z1&x=1jqt",lbl:"Open Quizlet Set"},{cat:"reading",title:"Decoding practice - break words before looking them up",detail:"Every time you find a hard word this week, break it into prefix + root + suffix first.",link:null,lbl:null}],journalPrompt:"Write 3 words you found difficult this week. Break each one into parts - prefix, root, suffix. How does knowing the parts help?",quizletLink:"https://quizlet.com/vn/1181497860/week-2-words-about-words-flash-cards/?i=75s0z1&x=1jqt",vocab:[["prefix","a group of letters added to the start of a word to change its meaning"],["suffix","a group of letters added to the end of a word to change its meaning"],["root","the base part of a word that carries the core meaning"],["syllable","a unit of sound in a word"],["definition","the meaning of a word or phrase"],["context","the words around a word that help explain its meaning"],["vocabulary","the set of words a person knows and uses"],["literal","the exact basic meaning of a word"],["figurative","using words in a non-literal imaginative way"],["infer","to work out something that is not directly stated"]]},{num:3,dates:"8-12 Jun",theme:"Reading Fluency",color:"#6C3483",focus:"Reading smoothly, steadily, and with confidence",tasks:[{cat:"reading",title:'CommonLit - "The Ravine" by Graham Salisbury',detail:"Read it TWICE before answering questions - once to understand, once to find evidence.",link:"https://www.commonlit.org/students/student_lessons/25093345",lbl:"Open Passage"},{cat:"reading",title:"ReadTheory - complete 5 quizzes and note your Lexile score",detail:"After the last quiz, compare your Lexile to Week 1 in your journal.",link:"https://readtheory.org",lbl:"Open ReadTheory"},{cat:"grammar",title:"Khan Academy - Grammar Unit 4: Parts of speech - the modifier",detail:"Watch all videos and complete all exercises.",link:"https://www.khanacademy.org/ela/grammar/parts-of-speech-the-modifier",lbl:"Open Khan Academy"},{cat:"grammar",title:"IXL - Reading comprehension skills",detail:"Choose two skills and aim for Smart Score 80 on each.",link:"https://www.ixl.com/ela/grade-8/",lbl:"Open IXL"},{cat:"vocab",title:"Quizlet - Week 3 set: words about reading",detail:"Study the Week 3 set. Use Learn mode first, then Test mode by Friday.",link:"https://quizlet.com/vn/1181498255/week-3-words-about-reading-flash-cards/?i=75s0z1&x=1jqt",lbl:"Open Quizlet Set"},{cat:"reading",title:"Read aloud - 15 minutes every morning",detail:"Each morning read any English text aloud for 15 minutes. Reading aloud builds fluency faster than silent reading.",link:null,lbl:null}],journalPrompt:"How did reading aloud feel this week? Was it easier by Friday? Write about one passage you read and one thing you noticed.",quizletLink:"https://quizlet.com/vn/1181498255/week-3-words-about-reading-flash-cards/?i=75s0z1&x=1jqt",vocab:[["fluency","the ability to read smoothly and at a natural pace"],["comprehend","to fully understand something"],["passage","a section of a text or piece of writing"],["pace","the speed at which something moves or happens"],["expression","the feeling conveyed when reading or speaking"],["accurate","correct and without mistakes"],["relevant","connected to the topic being discussed"],["sequence","the order in which events happen"],["interpret","to explain or understand the meaning of something"],["evidence","information that supports a claim or idea"]]},{num:4,dates:"15-19 Jun",theme:"Vocabulary Building",color:"#BA4A00",focus:"Tier 2 academic words - the language of school and exams",tasks:[{cat:"reading",title:"CommonLit - Soccer Speaks Many Languages by Dianna Geers",detail:"Read carefully and highlight every new academic word. Answer all questions.",link:"https://www.commonlit.org/students/student_lessons/25093375",lbl:"Open Passage"},{cat:"reading",title:"ReadTheory - complete 5 quizzes",detail:"Try to read each question carefully before going back to the passage.",link:"https://readtheory.org",lbl:"Open ReadTheory"},{cat:"grammar",title:"Khan Academy ELA - Word meanings: fiction 7",detail:"Search 'word meanings fiction 7' in the Khan Academy ELA section.",link:"https://www.khanacademy.org/ela/cc-4th-grade-ela/x4fc02ff927f33e89:7th-grade",lbl:"Open Khan Academy"},{cat:"grammar",title:"IXL - Vocabulary in context",detail:"Find Vocabulary in context in the English section. Aim for Smart Score 80.",link:"https://www.ixl.com/ela/grade-8/use-context-to-identify-the-meaning-of-a-word",lbl:"Open IXL"},{cat:"vocab",title:"Quizlet - Week 4 set: Tier 2 academic words",detail:"For each word: say it aloud, write the definition, and write one sentence.",link:"https://quizlet.com/vn/1181498374/week-4-tier-2-academic-words-flash-cards/?i=75s0z1&x=1jqt",lbl:"Open Quizlet Set"},{cat:"writing",title:"Journal - write a paragraph using 5 new words",detail:"Write 8-10 sentences using at least 5 words from your Week 4 Quizlet set.",link:null,lbl:null}],journalPrompt:"Write a paragraph of 8 to 10 sentences using at least 5 of your new vocabulary words. Put the definition in brackets after each new word.",quizletLink:"https://quizlet.com/vn/1181498374/week-4-tier-2-academic-words-flash-cards/?i=75s0z1&x=1jqt",vocab:[["significant","important or meaningful"],["demonstrate","to show clearly"],["establish","to set up or create something firmly"],["contribute","to add to or help with something"],["impact","a strong effect or influence"],["factor","something that influences a result"],["consequence","a result or effect of an action"],["purpose","the reason why something is done or created"],["structure","the way something is organised or arranged"],["perspective","a particular way of seeing or thinking about something"]]},{num:5,dates:"22-26 Jun",theme:"Comprehension Strategies",color:"#1E8449",focus:"Skimming, scanning, and finding answers quickly",tasks:[{cat:"reading",title:'CommonLit - "The Danger of a Single Story" by Chimamanda Ngozi Adichie',detail:"Before you read, skim the questions first. Then read and answer all questions.",link:"https://www.commonlit.org/students/student_lessons/25093377",lbl:"Open Passage"},{cat:"reading",title:"ReadTheory - complete 5 quizzes",detail:"Before each passage, spend 20 seconds skimming the first sentences.",link:"https://readtheory.org",lbl:"Open ReadTheory"},{cat:"grammar",title:"Khan Academy ELA - Text structure: history 7",detail:"Search 'text structure history 7' in the Khan Academy ELA section.",link:"https://www.khanacademy.org/ela/cc-4th-grade-ela/x4fc02ff927f33e89:7th-grade",lbl:"Open Khan Academy"},{cat:"grammar",title:"IXL - Reading strategies skills",detail:"Find Reading strategies. Aim for Smart Score 80 on two skills.",link:"https://www.ixl.com/ela/grade-8/",lbl:"Open IXL"},{cat:"vocab",title:"Quizlet - Week 5 set: words about comprehension",detail:"Study the Week 5 set. Use Learn mode first, then Test mode by Friday.",link:"https://quizlet.com/vn/1181498450/week-5-words-about-comprehension-flash-cards/?i=75s0z1&x=1jqt",lbl:"Open Quizlet Set"},{cat:"reading",title:"Skimming and scanning practice",detail:"Find any English article. Skim it, guess the topic, then scan for 3 facts in under 2 minutes.",link:null,lbl:null}],journalPrompt:"Describe your skimming and scanning practice. What article did you choose? How close was your guess? Did scanning feel easier by Friday?",quizletLink:"https://quizlet.com/vn/1181498450/week-5-words-about-comprehension-flash-cards/?i=75s0z1&x=1jqt",vocab:[["skim","to read quickly to get the general idea"],["scan","to look quickly through a text to find specific information"],["locate","to find the position of something"],["distinguish","to recognise the difference between two things"],["clarify","to make something easier to understand"],["conclude","to decide something after thinking carefully"],["assumption","something accepted as true without proof"],["imply","to suggest something without saying it directly"],["emphasise","to give special importance to something"],["logical","based on clear and sensible reasoning"]]},{num:6,dates:"29 Jun-3 Jul",theme:"Grammar for Writing",color:"#7D6608",focus:"Sentence structure, punctuation, and writing with clarity",tasks:[{cat:"reading",title:"CommonLit - Justice for All by Lynn Rymarz",detail:"Pay close attention to how the author builds sentences. Answer all questions.",link:"https://www.commonlit.org/students/student_lessons/25093418",lbl:"Open Passage"},{cat:"reading",title:"ReadTheory - complete 5 quizzes",detail:"After each quiz, look at wrong answers and re-read that part of the passage.",link:"https://readtheory.org",lbl:"Open ReadTheory"},{cat:"grammar",title:"Khan Academy - Grammar Unit 6: Punctuation - comma and apostrophe",detail:"Watch every video and complete every exercise. Commas change meaning.",link:"https://www.khanacademy.org/ela/grammar/punctuation-the-comma-and-the-apostrophe",lbl:"Open Khan Academy"},{cat:"grammar",title:"IXL - Sentence structure skills",detail:"Find Sentence structure. Aim for Smart Score 80 on two skills.",link:"https://www.ixl.com/ela/grade-8/",lbl:"Open IXL"},{cat:"vocab",title:"Quizlet - Week 6 set: grammar and writing words",detail:"Study the Week 6 set. Use Learn mode first, then Test mode by Friday.",link:"https://quizlet.com/vn/1181498528/week-6-words-about-grammar-and-writing-flash-cards/?i=75s0z1&x=1jqt",lbl:"Open Quizlet Set"},{cat:"writing",title:"Journal - write 3 entries this week",detail:"Write three entries of at least 8 sentences each. Read each one aloud after writing.",link:null,lbl:null}],journalPrompt:"Write about a time you had to make a difficult decision. What happened? What did you decide and why? Write at least 8 sentences.",quizletLink:"https://quizlet.com/vn/1181498528/week-6-words-about-grammar-and-writing-flash-cards/?i=75s0z1&x=1jqt",vocab:[["sentence","a group of words that expresses a complete thought"],["clause","a group of words containing a subject and a verb"],["punctuation","marks such as commas and full stops used in writing"],["paragraph","a section of writing that deals with one main idea"],["coherent","clear logical and easy to understand"],["concise","giving information clearly using few words"],["formal","suitable for serious or official situations"],["revise","to look at and improve a piece of writing"],["draft","an early version of a piece of writing"],["technique","a particular method or skill used to achieve something"]]},{num:7,dates:"6-10 Jul",theme:"Reading for Information",color:"#1A5276",focus:"Non-fiction texts, facts, and ELA-style comprehension questions",tasks:[{cat:"reading",title:'CommonLit - "The Pedestrian" by Ray Bradbury',detail:"Focus on what the author is trying to say, not just what happens.",link:"https://www.commonlit.org/students/student_lessons/25093390",lbl:"Open Passage"},{cat:"reading",title:"CommonLit - The Distracted Teenage Brain by Alison Pearce Stevens",detail:"Read fully. Write a 5 to 6 sentence summary in your own words in your journal.",link:"https://www.commonlit.org/students/student_lessons/25093530",lbl:"Open Passage"},{cat:"reading",title:"ReadTheory - complete 5 quizzes",detail:"Note what types of questions you keep getting wrong.",link:"https://readtheory.org",lbl:"Open ReadTheory"},{cat:"grammar",title:"Khan Academy ELA - Author's purpose: informational texts 7",detail:"Search 'authors purpose informational texts 7' in the Khan Academy ELA section.",link:"https://www.khanacademy.org/ela/cc-4th-grade-ela/x4fc02ff927f33e89:7th-grade",lbl:"Open Khan Academy"},{cat:"grammar",title:"IXL - Informational text skills",detail:"Find Informational text. Aim for Smart Score 80.",link:"https://www.ixl.com/ela/grade-8/",lbl:"Open IXL"},{cat:"vocab",title:"Quizlet - Week 7 set: words about non-fiction",detail:"Study the Week 7 set. Use Learn mode first, then Test mode by Friday.",link:"https://quizlet.com/vn/1181498587/week-7-words-about-non-fiction-flash-cards/?i=75s0z1&x=1jqt",lbl:"Open Quizlet Set"}],journalPrompt:"Write a 5 to 6 sentence summary of The Distracted Teenage Brain. What was the main argument? Did you agree with it?",quizletLink:"https://quizlet.com/vn/1181498587/week-7-words-about-non-fiction-flash-cards/?i=75s0z1&x=1jqt",vocab:[["argument","a set of reasons given to support an idea"],["claim","a statement that something is true"],["fact","something known to be true"],["opinion","a personal view or belief"],["source","where information comes from"],["reliable","able to be trusted and depended on"],["bias","an unfair preference for one side"],["objective","based on facts not personal feelings"],["inform","to give information about something"],["headline","the title of a newspaper or online article"]]},{num:8,dates:"13-17 Jul",theme:"Argument and Evidence",color:"#0E6655",focus:"Identifying claims, finding evidence, and evaluating arguments",tasks:[{cat:"reading",title:"CommonLit - Anti-Social Networks? by Celia Dodd",detail:"Read and identify the main claim. What evidence does the author use?",link:"https://www.commonlit.org/students/student_lessons/25093430",lbl:"Open Passage"},{cat:"reading",title:"CommonLit - Turning the Tide by Shay Maunz",detail:"Write 3 sentences: the claim, the evidence, and whether you agree.",link:"https://www.commonlit.org/students/student_lessons/25093444",lbl:"Open Passage"},{cat:"reading",title:"ReadTheory - complete 5 quizzes",detail:"Focus on questions about the author's purpose and main idea.",link:"https://readtheory.org",lbl:"Open ReadTheory"},{cat:"grammar",title:"Khan Academy ELA - Evaluate an argument 7",detail:"Search 'evaluate an argument 7' in the Khan Academy ELA section.",link:"https://www.khanacademy.org/ela/cc-4th-grade-ela/x4fc02ff927f33e89:7th-grade",lbl:"Open Khan Academy"},{cat:"grammar",title:"IXL - Fact and opinion",detail:"Find Fact and opinion. Aim for Smart Score 80.",link:"https://www.ixl.com/ela/grade-8/distinguish-facts-from-opinions",lbl:"Open IXL"},{cat:"writing",title:"Journal - write a short argument",detail:"Write 3 paragraphs: your claim, your evidence, your conclusion.",link:null,lbl:null}],journalPrompt:"Write 3 paragraphs: should students have homework during summer? Paragraph 1 is your claim. Paragraph 2 is your evidence. Paragraph 3 is your conclusion.",quizletLink:"https://quizlet.com/vn/1181498670/week-8-words-about-argument-and-persuasion-flash-cards/?i=75s0z1&x=1jqt",vocab:[["persuade","to convince someone to believe or do something"],["convince","to make someone believe something is true"],["assert","to state something confidently and firmly"],["refute","to prove that something is wrong"],["counterargument","an argument made against another argument"],["justify","to give reasons to support a decision or action"],["valid","based on sound reasoning and evidence"],["acknowledge","to recognise or accept that something is true"],["stance","a persons position or attitude on an issue"],["rhetoric","language designed to persuade or impress"]]},{num:9,dates:"20-24 Jul",theme:"Author's Craft",color:"#6C3483",focus:"Understanding how a writer creates meaning",tasks:[{cat:"reading",title:'CommonLit - "The Story of an Hour" by Kate Chopin',detail:"Read it twice. The second time, focus on word choices and tone.",link:"https://www.commonlit.org/students/student_lessons/25093397",lbl:"Open Passage"},{cat:"reading",title:"CommonLit - The Veldt by Ray Bradbury",detail:"Think about the theme - what message is Bradbury sending?",link:"https://www.commonlit.org/students/student_lessons/25093595",lbl:"Open Passage"},{cat:"reading",title:"ReadTheory - complete 5 quizzes",detail:"Pay close attention to questions about tone, theme, and author's purpose.",link:"https://readtheory.org",lbl:"Open ReadTheory"},{cat:"grammar",title:"Khan Academy ELA - Point of view: creative fiction 7",detail:"Search 'point of view creative fiction 7' in the Khan Academy ELA section.",link:"https://www.khanacademy.org/ela/cc-4th-grade-ela/x4fc02ff927f33e89:7th-grade",lbl:"Open Khan Academy"},{cat:"grammar",title:"IXL - Literary devices: figurative language",detail:"Find Figurative language. Aim for Smart Score 80.",link:"https://www.ixl.com/ela/grade-8/identify-the-meaning-of-figurative-language",lbl:"Open IXL"},{cat:"writing",title:"Journal - write your first analytical paragraph",detail:"Choose one passage. Write a paragraph explaining how the author uses one literary device.",link:null,lbl:null}],journalPrompt:"Choose one passage from this week. Write a paragraph explaining how the author uses one literary device. Name it, give an example, and explain its effect on the reader.",quizletLink:"https://quizlet.com/vn/1181498732/week-9-words-about-authors-craft-flash-cards/?i=75s0z1&x=1jqt",vocab:[["theme","the main message or idea of a text"],["tone","the authors attitude toward the subject or reader"],["imagery","descriptive language that creates a picture in the mind"],["symbolism","the use of objects or ideas to represent something else"],["irony","when something happens opposite to what is expected"],["metaphor","a comparison that says one thing is another"],["narrator","the person or voice that tells a story"],["foreshadow","to give a hint of what will happen later"],["motive","the reason a character does something"],["tension","a feeling of suspense or conflict in a text"]]},{num:10,dates:"27-31 Jul",theme:"Extended Reading",color:"#BA4A00",focus:"Building reading stamina - longer texts, deeper thinking",tasks:[{cat:"reading",title:'CommonLit - "The Landlady" by Roald Dahl',detail:"Take your time. Write a full-page response in your journal after reading.",link:"https://www.commonlit.org/students/student_lessons/25093399",lbl:"Open Passage"},{cat:"reading",title:"CommonLit - The Wright Brothers: Air Pioneers by David White",detail:"Read carefully and answer all questions.",link:"https://www.commonlit.org/students/student_lessons/25093524",lbl:"Open Passage"},{cat:"reading",title:"ReadTheory - complete 5 quizzes",detail:"Focus on inference questions - what does the author imply but not say?",link:"https://readtheory.org",lbl:"Open ReadTheory"},{cat:"grammar",title:"Khan Academy ELA - Key ideas: science 7",detail:"Search 'key ideas science 7' in the Khan Academy ELA section.",link:"https://www.khanacademy.org/ela/cc-4th-grade-ela/x4fc02ff927f33e89:7th-grade",lbl:"Open Khan Academy"},{cat:"grammar",title:"IXL - Drawing conclusions and making inferences",detail:"Find Making inferences. Aim for Smart Score 80.",link:"https://www.ixl.com/ela/grade-8/make-inferences",lbl:"Open IXL"},{cat:"vocab",title:"Quizlet - Week 10 set: words about inference",detail:"Study the Week 10 set.",link:"https://quizlet.com/vn/1181498773/week-10-words-about-inference-flash-cards/?i=75s0z1&x=1jqt",lbl:"Open Quizlet Set"}],journalPrompt:"Write a full-page response to The Landlady. What happened? What clues did the author give you? Were you surprised by the ending? Write at least 15 sentences.",quizletLink:"https://quizlet.com/vn/1181498773/week-10-words-about-inference-flash-cards/?i=75s0z1&x=1jqt",vocab:[["deduce","to reach a conclusion based on evidence and reasoning"],["implicit","suggested but not directly stated"],["explicit","stated clearly and directly"],["ambiguous","open to more than one interpretation"],["sustained","continuing for a long period"],["complex","made up of many connected parts and difficult to understand"],["nuance","a subtle difference in meaning or expression"],["excerpt","a short passage taken from a longer text"],["annotate","to add notes or comments to a text"],["significant","deserving careful attention and thought"]]},{num:11,dates:"3-7 Aug",theme:"Grade 10 ELA Preparation",color:"#1E8449",focus:"Longer texts, harder questions - this is what Grade 10 feels like",tasks:[{cat:"reading",title:'CommonLit - "The Necklace" by Guy de Maupassant',detail:"Pay attention to the theme of ambition and consequence. Answer all questions thoroughly.",link:"https://www.commonlit.org/students/student_lessons/25093405",lbl:"Open Passage"},{cat:"reading",title:"CommonLit - Life Isn't Fair - Deal With It by Mike Myatt",detail:"Do you agree or disagree with the author? Write your response in your journal.",link:"https://www.commonlit.org/students/student_lessons/25093528",lbl:"Open Passage"},{cat:"reading",title:"ReadTheory - complete 5 quizzes",detail:"You are in the final stretch - push yourself.",link:"https://readtheory.org",lbl:"Open ReadTheory"},{cat:"grammar",title:"Khan Academy - Grammar Course Challenge",detail:"This tests everything. Click Start Course Challenge at khanacademy.org/ela/grammar.",link:"https://www.khanacademy.org/ela/grammar",lbl:"Open Khan Academy"},{cat:"grammar",title:"IXL - revisit your 3 weakest skills from Week 1",detail:"Find the 3 weakest skills from your Week 1 diagnostic. Work on each until Smart Score 80.",link:"https://www.ixl.com/ela/grade-8/",lbl:"Open IXL"},{cat:"writing",title:"Journal - write your first 5-paragraph essay",detail:"Topic: What does it take to achieve a dream? Introduction, 3 body paragraphs, conclusion.",link:null,lbl:null}],journalPrompt:"Write a 5-paragraph essay: What does it take to achieve a dream? Introduction, 3 body paragraphs with evidence from your reading this summer, and a conclusion.",quizletLink:"https://quizlet.com/vn/1181498840/week-11-grade-10-academic-words-flash-cards/?i=75s0z1&x=1jqt",vocab:[["evaluate","to judge the value or quality of something"],["synthesise","to combine information from different sources into one idea"],["critique","to assess the strengths and weaknesses of something"],["elaborate","to add more detail or explanation"],["coherence","the quality of being logical and consistent"],["transition","a word or phrase that connects ideas"],["assertion","a confident statement of fact or belief"],["rationale","the reasons or logic behind a decision"],["integrate","to combine different elements into a whole"],["conviction","a firm belief or opinion"]]},{num:12,dates:"14-17 Aug",theme:"Final Review",color:"#1A5276",focus:"Look back at how far you have come - you are ready for Grade 10",tasks:[{cat:"reading",title:"ReadTheory - re-take your placement quiz",detail:"Compare your new Lexile to Week 1. Write the difference in your journal.",link:"https://readtheory.org",lbl:"Open ReadTheory"},{cat:"reading",title:"CommonLit - your free-choice final passage",detail:"Choose any passage you want. Take your time and answer every question.",link:"https://www.commonlit.org/home",lbl:"Open CommonLit"},{cat:"grammar",title:"Khan Academy - Grammar Course Challenge re-attempt",detail:"Re-take the Course Challenge. Compare your score to Week 11.",link:"https://www.khanacademy.org/ela/grammar",lbl:"Open Khan Academy"},{cat:"grammar",title:"IXL - revisit any skill still below Smart Score 80",detail:"Check your dashboard and work on any skill still below 80.",link:"https://www.ixl.com/ela/grade-8/",lbl:"Open IXL"},{cat:"vocab",title:"Vocabulary - go back through all 12 weeks",detail:"Go to the Vocabulary tab. Click through every week and read through all your words.",link:null,lbl:null},{cat:"writing",title:"Journal - write a letter to yourself",detail:"What did you learn this summer? What was hard? What are you looking forward to in Grade 10?",link:null,lbl:null}],journalPrompt:"Write a letter to yourself. What did you learn this summer? What was the hardest week? What are you most proud of? What are you looking forward to in Grade 10?",quizletLink:null,vocab:[["reflect","to think carefully about something"],["progress","movement toward a goal or improvement"],["achievement","something successfully accomplished"],["resilience","the ability to recover from difficulties"],["aspiration","a strong desire to achieve something"],["determination","the quality of being firm in pursuing a goal"],["challenge","something difficult that requires effort"],["confidence","belief in your own abilities"],["potential","the ability to develop or achieve something in the future"],["persevere","to continue despite difficulty"]]}];

const MOTIVATIONS=["Keep going - every tick is a step forward.","You are doing it. Consistency beats perfection every time.","Halfway there. Your English is getting stronger every day.","Look at all those ticks. That is hard work, not luck.","Almost done. Your Grade 10 teachers will notice the difference."];
const CAT={reading:"Reading",writing:"Writing",grammar:"Grammar",vocab:"Vocabulary"};

// ── TAB SWITCHING ─────────────────────────────────────────────────────────────
function showTab(name){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
  document.getElementById("tab-"+name).classList.add("active");
  document.querySelectorAll(".tab-btn")[["tracker","journal","vocab"].indexOf(name)].classList.add("active");
}

// ── TRACKER ───────────────────────────────────────────────────────────────────
function updateStats(){
  let done=0,total=0;
  WEEKS.forEach(w=>w.tasks.forEach((_,ti)=>{total++;if(state["t_"+w.num+"_"+ti])done++;}));
  document.getElementById("s-done").textContent=done;
  document.getElementById("s-total").textContent=total;
  const pct=total?Math.round(done/total*100):0;
  document.getElementById("s-pct").textContent=pct+"%";
  document.getElementById("main-bar").style.width=pct+"%";
  const mb=document.getElementById("motivebox");
  if(done===0)mb.innerHTML="<strong>Hey ${studentName}</strong> - tap a week to get started. Every small step counts.";
  else if(done===total)mb.innerHTML="<strong>You finished the whole programme.</strong> You walked in as an ESL student and you are walking out as an ELA student. See you in August.";
  else{const idx=Math.min(Math.floor((done/total)*MOTIVATIONS.length),MOTIVATIONS.length-1);mb.innerHTML="<strong>"+done+" tasks done</strong> - "+MOTIVATIONS[idx];}
  WEEKS.forEach(w=>{
    let wd=0;w.tasks.forEach((_,ti)=>{if(state["t_"+w.num+"_"+ti])wd++;});
    const badge=document.getElementById("badge-"+w.num);
    const mbar=document.getElementById("mbar-"+w.num);
    const wpct=Math.round(wd/w.tasks.length*100);
    if(badge){if(wd===w.tasks.length){badge.textContent="Done";badge.style.cssText="background:#D1F2EB;color:#0E6655";}else if(wd>0){badge.textContent=wd+"/"+w.tasks.length;badge.style.cssText="background:#FCF3CF;color:#7D6608";}else{badge.textContent="0/"+w.tasks.length;badge.style.cssText="background:#f0f0f0;color:#aaa";}}
    if(mbar){mbar.style.width=wpct+"%";mbar.style.background=wd===w.tasks.length?"#0E6655":w.color;}
  });
}

function toggleWeek(num){
  const body=document.getElementById("wbody-"+num);
  const chev=document.getElementById("chev-"+num);
  body.classList.toggle("open");
  chev.classList.toggle("open",body.classList.contains("open"));
}

function toggleTask(wn,ti){
  const k="t_"+wn+"_"+ti;
  state[k]=!state[k];save();
  document.getElementById("cb-"+wn+"-"+ti).classList.toggle("done",state[k]);
  document.getElementById("ttl-"+wn+"-"+ti).classList.toggle("done",state[k]);
  document.getElementById("dtl-"+wn+"-"+ti).classList.toggle("done",state[k]);
  updateStats();
  const w=WEEKS.find(x=>x.num===wn);
  sync({type:"task",week:wn,weekTheme:w.theme,taskTitle:w.tasks[ti].title,category:w.tasks[ti].cat,completed:state[k]});
}

function resetTracker(){
  if(confirm("Reset all your progress? This cannot be undone.")){
    Object.keys(state).filter(k=>k.startsWith("t_")).forEach(k=>delete state[k]);
    save();
    document.querySelectorAll(".cb").forEach(c=>c.classList.remove("done"));
    document.querySelectorAll(".task-title,.task-detail").forEach(t=>t.classList.remove("done"));
    updateStats();
  }
}

const wc=document.getElementById("weeks-container");
WEEKS.forEach(w=>{
  const div=document.createElement("div");
  div.className="week-card";
  div.innerHTML=
    '<div class="week-hdr" onclick="toggleWeek('+w.num+')">'+
    '<div class="wh-left"><div class="wdot" style="background:'+w.color+'"></div>'+
    '<div><div class="wname">Week '+w.num+' &nbsp;·&nbsp; '+w.theme+'</div><div class="wdates">'+w.dates+'</div></div></div>'+
    '<div class="wh-right"><span class="wbadge" id="badge-'+w.num+'" style="background:#f0f0f0;color:#aaa">0/'+w.tasks.length+'</span>'+
    '<span class="wchev" id="chev-'+w.num+'">&#8964;</span></div></div>'+
    '<div class="minibar-wrap"><div class="minibar" id="mbar-'+w.num+'" style="width:0%;background:'+w.color+'"></div></div>'+
    '<div class="week-body" id="wbody-'+w.num+'">'+
    '<div class="week-focus">Focus: '+w.focus+'</div>'+
    w.tasks.map((t,i)=>
      '<div class="task" onclick="toggleTask('+w.num+','+i+')">'+
      '<div class="cb" id="cb-'+w.num+'-'+i+'"><svg viewBox="0 0 11 11" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5,5.5 4.5,8.5 9.5,2.5"/></svg></div>'+
      '<div class="task-right"><div class="task-top">'+
      '<span class="cat-tag cat-'+t.cat+'">'+CAT[t.cat]+'</span>'+
      '<span class="task-title" id="ttl-'+w.num+'-'+i+'">'+t.title+'</span></div>'+
      '<div class="task-detail" id="dtl-'+w.num+'-'+i+'">'+t.detail+'</div>'+
      (t.link?'<a class="task-link" href="'+t.link+'" target="_blank" onclick="event.stopPropagation()">'+t.lbl+'</a>':'')+
      '</div></div>'
    ).join('')+
    '</div>';
  wc.appendChild(div);
});
WEEKS.forEach(w=>w.tasks.forEach((_,ti)=>{
  if(state["t_"+w.num+"_"+ti]){
    document.getElementById("cb-"+w.num+"-"+ti).classList.add("done");
    document.getElementById("ttl-"+w.num+"-"+ti).classList.add("done");
    document.getElementById("dtl-"+w.num+"-"+ti).classList.add("done");
  }
}));
updateStats();

// ── JOURNAL ───────────────────────────────────────────────────────────────────
let cjw=1;
function buildJBtns(){
  const c=document.getElementById("j-week-btns");
  WEEKS.forEach(w=>{
    const b=document.createElement("button");
    b.className="ws-btn"+(w.num===1?" ja":"");
    b.textContent="Week "+w.num;
    b.onclick=()=>selJWeek(w.num);
    c.appendChild(b);
  });
}
function selJWeek(num){
  cjw=num;
  document.querySelectorAll("#j-week-btns .ws-btn").forEach((b,i)=>b.classList.toggle("ja",i===num-1));
  const w=WEEKS.find(x=>x.num===num);
  document.getElementById("j-prompt").innerHTML="<strong>Writing prompt:</strong> "+w.journalPrompt;
  document.getElementById("j-label").textContent="Week "+num+" - "+w.theme;
  document.getElementById("j-textarea").value=state["jd_"+num]||"";
  updateWC();renderJHist(num);
}
function updateWC(){
  const txt=document.getElementById("j-textarea").value.trim();
  const wds=txt?txt.split(/\s+/).length:0;
  document.getElementById("j-wc").textContent=wds+" word"+(wds===1?"":"s");
  state["jd_"+cjw]=document.getElementById("j-textarea").value;save();
}
function saveJournal(){
  const txt=document.getElementById("j-textarea").value.trim();
  if(!txt)return;
  const entries=state["je_"+cjw]||[];
  entries.unshift({date:new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}),text:txt});
  state["je_"+cjw]=entries;save();
  const msg=document.getElementById("saved-msg");
  msg.classList.add("show");setTimeout(()=>msg.classList.remove("show"),2000);
  renderJHist(cjw);
  const w=WEEKS.find(x=>x.num===cjw);
  sync({type:"journal",week:cjw,weekTheme:w.theme,text:txt,wordCount:txt.split(/\s+/).length});
}
function renderJHist(num){
  const entries=state["je_"+num]||[];
  const c=document.getElementById("j-history");
  if(!entries.length){c.innerHTML="";return;}
  c.innerHTML='<div class="j-hist-lbl">Previous entries</div>'+entries.map((e,i)=>{
    const gradeClass = e.grade ? 'grade-'+e.grade.toLowerCase() : '';
    const feedbackHtml = e.feedback ?
      '<div class="fb-received">'+
        '<div class="fb-received-header">'+
          '<span class="fb-received-label">Teacher feedback</span>'+
          (e.grade ? '<span class="fb-received-grade '+gradeClass+'">'+e.grade+'</span>' : '')+
        '</div>'+
        '<div class="fb-received-text">'+e.feedback+'</div>'+
      '</div>' : '';
    return '<div class="j-entry"><div class="j-entry-date">'+e.date+'</div>'+
      '<div class="j-entry-text" id="jhe-'+num+'-'+i+'">'+e.text+'</div>'+
      '<span class="j-exp" data-id="jhe-'+num+'-'+i+'">Show more</span>'+
      feedbackHtml+'</div>';
  }).join("");
}
function togJE(id,el){
  const d=document.getElementById(id);d.classList.toggle("exp");
  el.textContent=d.classList.contains("exp")?"Show less":"Show more";
}
document.getElementById("j-textarea").addEventListener("input",updateWC);
document.getElementById("j-textarea").addEventListener("paste",function(e){
  e.preventDefault();
  alert("Please type your journal entry - copy and paste is not allowed.");
});
buildJBtns();selJWeek(1);

// ── Load and display teacher feedback ─────────────────────────────────────────
async function loadFeedback() {
  try {
    const r = await fetch(window.location.origin + '/api/feedback/' + encodeURIComponent(STUDENT_NAME) + '?t=' + Date.now());
    const j = await r.json();
    const feedbackList = j.feedback || [];
    feedbackList.filter(f => f.Published === 'Yes').forEach(fb => {
      // Find matching journal entry display
      const weekNum = parseInt((fb.Week||'').replace(/[^0-9]/g,''));
      const entryIdx = parseInt(fb.EntryIndex || 0);
      if(!isNaN(weekNum)) {
        const entries = state['je_' + weekNum] || [];
        const entry = entries[entryIdx];
        if(entry) {
          // Mark entry as having feedback
          entry.feedback = fb.FeedbackText;
          entry.grade = fb.Grade;
        }
        state['je_' + weekNum] = entries;
      }
    });
    // Re-render current journal week if feedback arrived
    renderJHist(cjw);
  } catch(e) {
    console.log('Feedback load failed:', e);
  }
}
loadFeedback();
// Journal expand handlers via event delegation
document.addEventListener('click',function(e){
  if(e.target.classList.contains('j-exp')){
    const id=e.target.getAttribute('data-id');
    const d=document.getElementById(id);
    if(d){d.classList.toggle('exp');e.target.textContent=d.classList.contains('exp')?'Show less':'Show more';}
  }
});

// ── VOCAB ─────────────────────────────────────────────────────────────────────
let cvw=1,fci=0,fcFlipped=false,vMode="flash";
function buildVBtns(){
  const c=document.getElementById("v-week-btns");
  WEEKS.forEach(w=>{
    const b=document.createElement("button");
    b.className="ws-btn"+(w.num===1?" va":"");
    b.textContent="Week "+w.num;
    b.onclick=()=>selVWeek(w.num);
    c.appendChild(b);
  });
}
function selVWeek(num){
  cvw=num;fci=0;fcFlipped=false;
  document.querySelectorAll("#v-week-btns .ws-btn").forEach((b,i)=>b.classList.toggle("va",i===num-1));
  const w=WEEKS.find(x=>x.num===num);
  const qbox=document.getElementById("q-box");
  const note=document.getElementById("vocab-all-note");
  if(num===12){qbox.style.display="none";note.style.display="block";}
  else{note.style.display="none";if(w.quizletLink){qbox.style.display="flex";document.getElementById("q-btn").href=w.quizletLink;}else{qbox.style.display="none";}}
  renderVocab();
}
function renderVocab(){
  const w=WEEKS.find(x=>x.num===cvw);
  if(vMode==="flash")renderFC(w);else renderWL(w);
}
function renderFC(w){
  document.getElementById("v-flash").style.display="block";
  document.getElementById("v-list").style.display="none";
  fcFlipped=false;
  document.getElementById("flashcard").classList.remove("flipped");
  document.getElementById("fc-word").textContent=w.vocab[fci][0];
  document.getElementById("fc-def").textContent=w.vocab[fci][1];
  document.getElementById("fc-counter").textContent=(fci+1)+" / "+w.vocab.length;
}
function renderWL(w){
  document.getElementById("v-flash").style.display="none";
  document.getElementById("v-list").style.display="block";
  document.getElementById("word-list").innerHTML=w.vocab.map(v=>
    '<div class="word-row"><div class="word-term">'+v[0]+'</div><div class="word-def">'+v[1]+'</div></div>'
  ).join("");
}
function flipCard(){
  fcFlipped=!fcFlipped;
  document.getElementById("flashcard").classList.toggle("flipped",fcFlipped);
  const w=WEEKS.find(x=>x.num===cvw);
  sync({type:"vocab",week:cvw,weekTheme:w.theme,word:w.vocab[fci][0],action:fcFlipped?"revealed":"hidden"});
}
function fcNext(){const w=WEEKS.find(x=>x.num===cvw);fci=(fci+1)%w.vocab.length;renderFC(w);}
function fcPrev(){const w=WEEKS.find(x=>x.num===cvw);fci=(fci-1+w.vocab.length)%w.vocab.length;renderFC(w);}
function setVMode(mode){
  vMode=mode;
  document.querySelectorAll(".v-mode").forEach((b,i)=>b.classList.toggle("active",["flash","list"][i]===mode));
  renderVocab();
}
buildVBtns();selVWeek(1);
</script>
</body>
</html>`;
}

// ── Teacher dashboard HTML ────────────────────────────────────────────────────
function dashboardPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Teacher Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f4f8;min-height:100vh}
.nav{background:linear-gradient(135deg,#1A5276 0%,#0E6655 100%);padding:0.9rem 1.5rem;box-shadow:0 2px 8px rgba(0,0,0,.18)}
.nav-inner{max-width:1000px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.nav h1{font-size:17px;font-weight:600;color:#fff}
.nav p{font-size:11px;color:rgba(255,255,255,.7)}
.nav-right{display:flex;align-items:center;gap:10px}
.refresh-btn{padding:6px 14px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);border-radius:8px;color:#fff;font-size:12px;cursor:pointer}
.last-updated{font-size:11px;color:rgba(255,255,255,.6)}
.wrap{max-width:1000px;margin:0 auto;padding:1.25rem}
.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:1.25rem}
.sum-card{background:#fff;border-radius:10px;padding:.75rem;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.sum-val{font-size:26px;font-weight:700;color:#1A5276;display:block}
.sum-lbl{font-size:11px;color:#888;margin-top:2px}
.student-tab-row{display:flex;gap:4px;background:#fff;border-radius:12px;padding:6px;box-shadow:0 1px 3px rgba(0,0,0,.06);margin-bottom:1.25rem;flex-wrap:wrap}
.student-tab{padding:8px 18px;font-size:13px;font-weight:500;border-radius:8px;border:none;background:none;cursor:pointer;color:#777;white-space:nowrap}
.student-tab:hover{background:#f0f4f8;color:#1A5276}
.student-tab.active{background:#1A5276;color:#fff}
.tab-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:2px}
.student-panel{display:none}.student-panel.active{display:block}
.student-header{background:#fff;border-radius:12px;padding:1rem 1.25rem;margin-bottom:1rem;box-shadow:0 1px 3px rgba(0,0,0,.06);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.sh-left{display:flex;align-items:center;gap:12px}
.sh-avatar{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#1A5276,#0E6655);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#fff;flex-shrink:0}
.sh-name{font-size:17px;font-weight:600;color:#1a1a2e}
.sh-meta{font-size:12px;color:#aaa;margin-top:2px}
.sh-stats{display:flex;gap:16px;flex-wrap:wrap}
.sh-stat{text-align:center}
.sh-stat-val{font-size:20px;font-weight:700;color:#1A5276;display:block}
.sh-stat-lbl{font-size:11px;color:#aaa}
.prog-section{background:#fff;border-radius:12px;padding:1rem 1.25rem;margin-bottom:1rem;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.prog-label{display:flex;justify-content:space-between;font-size:12px;color:#aaa;margin-bottom:6px}
.prog-wrap{background:#e0e6ed;border-radius:99px;height:8px;overflow:hidden}
.prog-fill{height:8px;border-radius:99px;background:linear-gradient(90deg,#1A5276,#0E6655);transition:width .4s}
.subtab-row{display:flex;gap:6px;margin-bottom:1rem;border-bottom:2px solid #e0e6ed}
.subtab{padding:8px 16px;font-size:13px;font-weight:500;border:none;background:none;cursor:pointer;color:#aaa;border-bottom:2px solid transparent;margin-bottom:-2px}
.subtab:hover{color:#1A5276}.subtab.active{color:#1A5276;border-bottom-color:#1A5276}
.subview{display:none}.subview.active{display:block}
.week-group{background:#fff;border-radius:12px;margin-bottom:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.wg-minibar-wrap{height:3px;background:#f0f0f0}.wg-minibar{height:3px}
.wg-header{display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;cursor:pointer;user-select:none}
.wg-header:hover{background:#f8f9fa}
.wg-title{font-size:13px;font-weight:600;color:#1a1a2e}
.wg-theme{font-size:12px;color:#aaa;margin-top:1px}
.wg-right{display:flex;align-items:center;gap:8px}
.wg-badge{font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px}
.wg-chev{font-size:16px;color:#ccc;transition:transform .2s}
.wg-chev.open{transform:rotate(180deg)}
.wg-body{display:none;border-top:1px solid #f0f0f0}.wg-body.open{display:block}
.task-row{display:flex;align-items:flex-start;gap:10px;padding:9px 1rem;border-bottom:1px solid #f8f8f8;font-size:13px}
.task-row:last-child{border-bottom:none}
.task-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;margin-top:3px}
.task-dot.done{background:#0E6655}.task-dot.undone{background:#e0e0e0}
.task-info{flex:1}.task-name{color:#333;line-height:1.4}.task-name.done{color:#bbb;text-decoration:line-through}
.task-bottom{display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap}
.cat-pill{font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;text-transform:uppercase;white-space:nowrap}
.cat-reading{background:#D6EAF8;color:#1A5276}.cat-writing{background:#F4ECF7;color:#6C3483}
.cat-grammar{background:#D1F2EB;color:#0E6655}.cat-vocab{background:#FDEBD0;color:#BA4A00}
.task-time{font-size:11px;color:#aaa}
.journal-entry{background:#fff;border-radius:12px;padding:1rem 1.25rem;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);border-left:4px solid #1A5276}
.je-meta{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:.75rem}
.je-week{font-size:12px;font-weight:600;color:#1A5276;background:#D6EAF8;padding:2px 8px;border-radius:4px}
.je-theme{font-size:12px;color:#aaa}.je-date{font-size:11px;color:#aaa}
.je-wc{font-size:11px;font-weight:600;color:#0E6655;background:#D1F2EB;padding:1px 7px;border-radius:99px}
.je-text{font-size:13px;color:#333;line-height:1.75;white-space:pre-wrap;max-height:100px;overflow:hidden}
.je-text.expanded{max-height:none}
.je-expand{font-size:12px;color:#1A5276;cursor:pointer;margin-top:6px;display:inline-block;font-weight:500}
.vocab-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}
.vocab-card{background:#fff;border-radius:8px;padding:.65rem .85rem;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.vc-word{font-size:13px;font-weight:600;color:#1A5276}
.empty{text-align:center;padding:2rem;color:#aaa;font-size:13px;font-style:italic;background:#fff;border-radius:12px}
.no-data{background:#FFF9F0;border:1.5px solid #FDEBD0;border-radius:12px;padding:1.25rem;text-align:center;color:#BA4A00;font-size:13px;margin-bottom:1rem}
.no-data strong{display:block;font-size:15px;margin-bottom:4px;color:#7D6608}
.dot-active{background:#0E6655}.dot-recent{background:#F39C12}.dot-inactive{background:#E74C3C}.dot-none{background:#ccc}
.fb-section{margin-top:1rem;padding-top:1rem;border-top:1px solid #f0f0f0}
.fb-header{margin-bottom:0.5rem}
.fb-status{font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px}
.fb-status.draft{background:#FFF9F0;color:#BA4A00;border:1px solid #FDEBD0}
.fb-status.published{background:#D1F2EB;color:#0E6655;border:1px solid #A9DFBF}
.fb-controls{display:flex;flex-direction:column;gap:8px}
.fb-grade-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.fb-label{font-size:12px;color:#777;font-weight:500}
.fb-grade{padding:4px 8px;font-size:12px;border:1.5px solid #ddd;border-radius:6px;background:#fff;color:#444;outline:none}
.fb-grade:focus{border-color:#1A5276}
.fb-ai-btn{padding:4px 10px;font-size:12px;font-weight:500;border:1.5px solid #6C3483;border-radius:6px;background:#F4ECF7;color:#6C3483;cursor:pointer;white-space:nowrap}
.fb-ai-btn:hover{background:#E8DAEF}
.fb-ai-btn:disabled{opacity:0.5;cursor:wait}
.fb-textarea{width:100%;min-height:100px;border:1.5px solid #e0e6ed;border-radius:8px;padding:0.65rem;font-size:13px;font-family:inherit;color:#333;line-height:1.6;resize:vertical;outline:none}
.fb-textarea:focus{border-color:#1A5276}
.fb-btn-row{display:flex;align-items:center;justify-content:space-between}
.fb-saved-msg{font-size:11px;color:#0E6655}
.fb-publish-btn{padding:6px 16px;background:#1A5276;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
.fb-publish-btn:hover{background:#154360}
.fb-publish-btn.published{background:#0E6655}
.fb-publish-btn.published:hover{background:#0a4f3d}
</style>
</head>
<body>
<div class="nav">
  <div class="nav-inner">
    <div><h1>Teacher Dashboard</h1><p>Summer English Programme 2026</p></div>
    <div class="nav-right">
      <span class="last-updated" id="lu">Loading...</span>
      <button class="refresh-btn" onclick="loadData()">Refresh</button>
    </div>
  </div>
</div>
<div class="wrap">
  <div class="summary-grid">
    <div class="sum-card"><span class="sum-val" id="ss">-</span><span class="sum-lbl">Students</span></div>
    <div class="sum-card"><span class="sum-val" id="st">-</span><span class="sum-lbl">Tasks completed</span></div>
    <div class="sum-card"><span class="sum-val" id="sj">-</span><span class="sum-lbl">Journal entries</span></div>
    <div class="sum-card"><span class="sum-val" id="sw">-</span><span class="sum-lbl">Words written</span></div>
    <div class="sum-card"><span class="sum-val" id="sv">-</span><span class="sum-lbl">Vocab cards</span></div>
    <div class="sum-card"><span class="sum-val" id="sa">-</span><span class="sum-lbl">Active today</span></div>
  </div>
  <div id="mc"><div class="empty">Loading student data...</div></div>
</div>
<script>
const T=72;
const WEEKS_ALL=[
{num:1,theme:"Getting Started",tasks:["ReadTheory - complete your placement test","CommonLit - read your first free-choice passage","IXL - complete the English Diagnostic","Khan Academy - Grammar Unit 1: Parts of speech - the noun","Quizlet - set up your account and study Week 1 word set","Journal - write your summer goals"]},
{num:2,theme:"Phonics and Decoding",tasks:["CommonLit - The Jacket by Gary Soto","ReadTheory - complete 5 quizzes","Khan Academy - Grammar Unit 2: Parts of speech - the verb","IXL - Prefixes and suffixes","Quizlet - Week 2 set: roots and affixes","Decoding practice - break words before looking them up"]},
{num:3,theme:"Reading Fluency",tasks:["CommonLit - The Ravine by Graham Salisbury","ReadTheory - complete 5 quizzes and note your Lexile score","Khan Academy - Grammar Unit 4: Parts of speech - the modifier","IXL - Reading comprehension skills","Quizlet - Week 3 set: words about reading","Read aloud - 15 minutes every morning"]},
{num:4,theme:"Vocabulary Building",tasks:["CommonLit - Soccer Speaks Many Languages by Dianna Geers","ReadTheory - complete 5 quizzes","Khan Academy ELA - Word meanings: fiction 7","IXL - Vocabulary in context","Quizlet - Week 4 set: Tier 2 academic words","Journal - write a paragraph using 5 new words"]},
{num:5,theme:"Comprehension Strategies",tasks:["CommonLit - The Danger of a Single Story by Adichie","ReadTheory - complete 5 quizzes","Khan Academy ELA - Text structure: history 7","IXL - Reading strategies skills","Quizlet - Week 5 set: words about comprehension","Skimming and scanning practice"]},
{num:6,theme:"Grammar for Writing",tasks:["CommonLit - Justice for All by Lynn Rymarz","ReadTheory - complete 5 quizzes","Khan Academy - Grammar Unit 6: Punctuation - comma and apostrophe","IXL - Sentence structure skills","Quizlet - Week 6 set: grammar and writing words","Journal - write 3 entries this week"]},
{num:7,theme:"Reading for Information",tasks:["CommonLit - The Pedestrian by Ray Bradbury","CommonLit - The Distracted Teenage Brain","ReadTheory - complete 5 quizzes","Khan Academy ELA - Author's purpose: informational texts 7","IXL - Informational text skills","Quizlet - Week 7 set: words about non-fiction"]},
{num:8,theme:"Argument and Evidence",tasks:["CommonLit - Anti-Social Networks","CommonLit - Turning the Tide by Shay Maunz","ReadTheory - complete 5 quizzes","Khan Academy ELA - Evaluate an argument 7","IXL - Fact and opinion","Journal - write a short argument"]},
{num:9,theme:"Author's Craft",tasks:["CommonLit - The Story of an Hour by Kate Chopin","CommonLit - The Veldt by Ray Bradbury","ReadTheory - complete 5 quizzes","Khan Academy ELA - Point of view: creative fiction 7","IXL - Literary devices: figurative language","Journal - write your first analytical paragraph"]},
{num:10,theme:"Extended Reading",tasks:["CommonLit - The Landlady by Roald Dahl","CommonLit - The Wright Brothers: Air Pioneers","ReadTheory - complete 5 quizzes","Khan Academy ELA - Key ideas: science 7","IXL - Drawing conclusions and making inferences","Quizlet - Week 10 set: words about inference"]},
{num:11,theme:"Grade 10 ELA Preparation",tasks:["CommonLit - The Necklace by Guy de Maupassant","CommonLit - Life Isn't Fair - Deal With It","ReadTheory - complete 5 quizzes","Khan Academy - Grammar Course Challenge","IXL - revisit your 3 weakest skills from Week 1","Journal - write your first 5-paragraph essay"]},
{num:12,theme:"Final Review",tasks:["ReadTheory - re-take your placement quiz","CommonLit - your free-choice final passage","Khan Academy - Grammar Course Challenge re-attempt","IXL - revisit any skill still below Smart Score 80","Vocabulary - go back through all 12 weeks","Journal - write a letter to yourself"]}
];
let D={tasks:[],journals:[],vocab:[]},students=[],cur=null;

function esc(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function parseTs(ts){
  if(!ts) return null;
  let d = new Date(ts);
  if(isNaN(d.getTime()) && ts.includes('/')) {
    const parts = ts.split(', ');
    const dateParts = parts[0].split('/');
    const timePart = parts[1] || '00:00:00';
    d = new Date(dateParts[2]+'-'+dateParts[1]+'-'+dateParts[0]+'T'+timePart);
  }
  return isNaN(d.getTime()) ? null : d;
}
function fmt(ts){
  if(!ts) return '';
  try{
    let d = new Date(ts);
    // Handle DD/MM/YYYY, HH:MM:SS format from Google Sheets
    if(isNaN(d.getTime()) && ts.includes('/')) {
      const parts = ts.split(', ');
      const dateParts = parts[0].split('/');
      const timePart = parts[1] || '00:00:00';
      // Convert DD/MM/YYYY to YYYY-MM-DD
      d = new Date(dateParts[2]+'-'+dateParts[1]+'-'+dateParts[0]+'T'+timePart);
    }
    if(isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  }catch(x){return '';}
}

// Feedback draft storage (local, not yet published)
const fbDrafts = {};

function saveFbDraft(fbId) {
  fbDrafts[fbId] = {
    text: document.getElementById('text_'+fbId)?.value || '',
    grade: document.getElementById('grade_'+fbId)?.value || ''
  };
  const msg = document.getElementById('saved_'+fbId);
  if(msg){ msg.textContent = 'Draft saved'; setTimeout(()=>{ if(msg) msg.textContent=''; }, 2000); }
}

async function publishFeedback(fbId, studentName, week, entryIndex) {
  const text = document.getElementById('text_'+fbId)?.value?.trim();
  const grade = document.getElementById('grade_'+fbId)?.value;
  if(!text){ alert('Please write some feedback before publishing.'); return; }
  const btn = document.querySelector('[onclick*="'+fbId+'"][class*="publish"]');
  if(btn){ btn.textContent = 'Publishing...'; btn.disabled = true; }
  try {
    const r = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student: studentName, week, entryIndex, feedbackText: text, grade, published: true })
    });
    const j = await r.json();
    if(j.error) throw new Error(j.error);
    await loadData(); // Refresh to show published state
  } catch(e) {
    alert('Error publishing: ' + e.message);
    if(btn){ btn.textContent = 'Publish feedback'; btn.disabled = false; }
  }
}

async function generateFeedback(fbId, entryIndex, studentName, week) {
  const textarea = document.getElementById("text_"+fbId);
  const gradeEl = document.getElementById("grade_"+fbId);
  if(!textarea) return;

  var journalEls = document.querySelectorAll(".je-text");
  var journalEl = null;
  for(var k=0;k<journalEls.length;k++){
    if(journalEls[k].id.endsWith("_"+entryIndex)) { journalEl = journalEls[k]; break; }
  }
  const journalText = journalEl ? journalEl.textContent.trim() : "";
  if(!journalText){ alert("No journal text found."); return; }

  const weekNum = parseInt((week||"").replace(/[^0-9]/g,""));
  const prompts = {
    1:"Write 5 sentences about what you want to achieve this summer.",
    2:"Write 3 words you found difficult and break them into parts.",
    3:"How did reading aloud feel this week?",
    4:"Write a paragraph using at least 5 new vocabulary words.",
    5:"Describe your skimming and scanning practice.",
    6:"Write about a time you had to make a difficult decision.",
    7:"Write a 5-6 sentence summary of The Distracted Teenage Brain.",
    8:"Write 3 paragraphs arguing whether students should have homework during summer.",
    9:"Write an analytical paragraph explaining how an author uses a literary device.",
    10:"Write a full-page response to The Landlady by Roald Dahl.",
    11:"Write a 5-paragraph essay: What does it take to achieve a dream?",
    12:"Write a letter to yourself about what you learned this summer."
  };
  const prompt = prompts[weekNum] || "Respond to the weekly writing prompt.";

  const allBtns = document.querySelectorAll(".fb-ai-btn");
  allBtns.forEach(function(b){ if(b.getAttribute("data-fbid")===fbId){ b.disabled=true; b.textContent="Generating..."; }});

  try {
    const aiPrompt = "You are an experienced ELA teacher giving written feedback to a Grade 9 ESL student. Be warm, specific, encouraging, and professional. Writing prompt: " + prompt + " Student response: " + journalText + " Please provide: 1) A brief overall comment (2-3 sentences) 2) One specific strength with an example from the text 3) One clear improvement suggestion 4) A grade: Excellent, Good, or Developing. Format exactly as: FEEDBACK: [your feedback written to the student as you] GRADE: [Excellent/Good/Developing]";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: aiPrompt }]
      })
    });
    const data = await res.json();
    const reply = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : "";
    const feedbackMatch = reply.match(/FEEDBACK:\s*([\s\S]*?)(?=GRADE:|$)/i);
    const gradeMatch = reply.match(/GRADE:\s*(Excellent|Good|Developing)/i);
    if(feedbackMatch && feedbackMatch[1].trim()) {
      textarea.value = feedbackMatch[1].trim();
      saveFbDraft(fbId);
    }
    if(gradeMatch && gradeEl) { gradeEl.value = gradeMatch[1]; }
  } catch(e) {
    alert("AI suggestion failed: " + e.message);
  } finally {
    allBtns.forEach(function(b){ if(b.getAttribute("data-fbid")===fbId){ b.disabled=false; b.textContent="✨ AI suggestion"; }});
  }
}


async function loadData(){
  document.getElementById('lu').textContent='Loading...';
  try{
    const r=await fetch('/api/data?t='+Date.now());
    const j=await r.json();
    if(j.error)throw new Error(j.error);
    D.tasks=j.tasks||[];
    D.journals=j.journals||[];
    D.vocab=j.vocab||[];
    // Load all feedback
    try {
      const fr = await fetch('/api/feedback?t='+Date.now());
      const fj = await fr.json();
      D.feedback = fj.feedback || [];
    } catch(e) { D.feedback = []; }
    const names=[...D.tasks,...D.journals,...D.vocab].map(x=>x.Student).filter(Boolean);
    students=[...new Set(names)].sort();
    if(!cur&&students.length)cur=students[0];
    document.getElementById('lu').textContent='Updated '+new Date().toLocaleTimeString();
    render();
  }catch(err){
    document.getElementById('lu').textContent='Error: '+err.message;
    document.getElementById('mc').innerHTML='<div class="empty">Error: '+esc(err.message)+'</div>';
  }
}

function render(){
  const done=D.tasks.filter(t=>t.Completed==='Completed');
  const words=D.journals.reduce((s,j)=>s+(parseInt(j.WordCount)||0),0);
  const today=new Date().toLocaleDateString();
  const act=new Set([...D.tasks,...D.journals].filter(r=>{
    try{const d=parseTs(r.Timestamp);return d&&d.toLocaleDateString()===today;}catch(x){return false;}
  }).map(r=>r.Student)).size;
  document.getElementById('ss').textContent=students.length;
  document.getElementById('st').textContent=done.length;
  document.getElementById('sj').textContent=D.journals.length;
  document.getElementById('sw').textContent=words.toLocaleString();
  document.getElementById('sv').textContent=D.vocab.length;
  document.getElementById('sa').textContent=act;
  const mc=document.getElementById('mc');
  if(!students.length){
    mc.innerHTML='<div class="no-data"><strong>No student data yet</strong>Students need to open their pages and complete a task.</div>';
    return;
  }
  // Use data-name attribute to avoid apostrophe issues in onclick
  const tabs=students.map(s=>
    '<button class="student-tab'+(s===cur?' active':'')+'" data-name="'+esc(s)+'">'+
    '<span class="tab-dot '+dot(s)+'"></span>'+esc(s)+'</button>'
  ).join('');
  const panels=students.map(s=>buildPanel(s)).join('');
  mc.innerHTML='<div class="student-tab-row" id="tab-row">'+tabs+'</div>'+panels;
  // Add click handlers after DOM update
  document.querySelectorAll('.student-tab').forEach(btn=>{
    btn.addEventListener('click',function(){
      const name=this.getAttribute('data-name');
      cur=name;
      document.querySelectorAll('.student-tab').forEach(b=>b.classList.remove('active'));
      this.classList.add('active');
      document.querySelectorAll('.student-panel').forEach(p=>p.classList.toggle('active',p.getAttribute('data-name')===name));
      openFirst();
    });
  });
  // Add subtab handlers
  document.querySelectorAll('.subtab').forEach(btn=>{
    btn.addEventListener('click',function(){
      const panel=this.closest('.student-panel');
      const tab=this.getAttribute('data-tab');
      panel.querySelectorAll('.subtab').forEach(b=>b.classList.remove('active'));
      this.classList.add('active');
      panel.querySelectorAll('.subview').forEach(v=>v.classList.remove('active'));
      panel.querySelector('.subview[data-tab="'+tab+'"]').classList.add('active');
    });
  });
  // Add week group toggle handlers
  document.querySelectorAll('.wg-header').forEach(hdr=>{
    hdr.addEventListener('click',function(){
      const gid=this.getAttribute('data-gid');
      const body=document.getElementById(gid);
      const chev=document.getElementById('c-'+gid);
      if(body){const o=body.classList.toggle('open');if(chev)chev.classList.toggle('open',o);}
    });
  });
  // Add journal expand handlers
  document.querySelectorAll('.je-expand').forEach(btn=>{
    btn.addEventListener('click',function(){
      const d=document.getElementById(this.getAttribute('data-id'));
      if(d){d.classList.toggle('expanded');this.textContent=d.classList.contains('expanded')?'Show less':'Show full entry';}
    });
  });
  // Feedback textarea handlers
  document.querySelectorAll('.fb-textarea').forEach(function(ta){
    ta.addEventListener('input',function(){saveFbDraft(this.getAttribute('data-fbid'));});
  });
  document.querySelectorAll('.fb-grade').forEach(function(sel){
    sel.addEventListener('change',function(){saveFbDraft(this.getAttribute('data-fbid'));});
  });
  // AI suggestion button handlers
  document.querySelectorAll('.fb-ai-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      var fbId=this.getAttribute('data-fbid');
      var idx=parseInt(this.getAttribute('data-idx'));
      var panel=this.closest('.student-panel');
      var sName=panel?panel.getAttribute('data-name'):'';
      var week=this.getAttribute('data-week');
      generateFeedback(fbId,idx,sName,week);
    });
  });
  // Publish button handlers
  document.querySelectorAll('.fb-publish-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      var fbId=this.getAttribute('data-fbid');
      var panel=this.closest('.student-panel');
      var sName=panel?panel.getAttribute('data-name'):'';
      var entry=this.closest('.journal-entry');
      var week=entry?entry.getAttribute('data-week'):'';
      var idx=entry?parseInt(entry.getAttribute('data-idx')):0;
      publishFeedback(fbId,sName,week,idx);
    });
  });
  openFirst();
}

function openFirst(){
  const p=document.querySelector('.student-panel.active');if(!p)return;
  const b=p.querySelector('.wg-body'),c=p.querySelector('.wg-chev');
  if(b)b.classList.add('open');if(c)c.classList.add('open');
}

function buildPanel(name){
  const tk=D.tasks.filter(t=>t.Student===name);
  const cp=tk.filter(t=>t.Completed==='Completed');
  const jn=D.journals.filter(j=>j.Student===name);
  const vc=D.vocab.filter(v=>v.Student===name);
  const wd=jn.reduce((s,j)=>s+(parseInt(j.WordCount)||0),0);
  const pct=Math.min(Math.round(cp.length/T*100),100);
  const la=lastActive(name);
  const ini=name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  return '<div class="student-panel'+(name===cur?' active':'')+'" data-name="'+esc(name)+'">'+
    '<div class="student-header"><div class="sh-left"><div class="sh-avatar">'+esc(ini)+'</div>'+
    '<div><div class="sh-name">'+esc(name)+'</div>'+
    '<div class="sh-meta">'+esc(statusLabel(name))+' &nbsp;·&nbsp; Last active: '+(la?fmt(la):'No activity yet')+'</div></div></div>'+
    '<div class="sh-stats">'+
    '<div class="sh-stat"><span class="sh-stat-val">'+cp.length+'</span><span class="sh-stat-lbl">Tasks done</span></div>'+
    '<div class="sh-stat"><span class="sh-stat-val">'+jn.length+'</span><span class="sh-stat-lbl">Journal entries</span></div>'+
    '<div class="sh-stat"><span class="sh-stat-val">'+wd.toLocaleString()+'</span><span class="sh-stat-lbl">Words written</span></div>'+
    '<div class="sh-stat"><span class="sh-stat-val">'+vc.length+'</span><span class="sh-stat-lbl">Vocab cards</span></div>'+
    '</div></div>'+
    '<div class="prog-section"><div class="prog-label"><span>Overall progress</span><span>'+pct+'% ('+cp.length+' of '+T+' tasks)</span></div>'+
    '<div class="prog-wrap"><div class="prog-fill" style="width:'+pct+'%"></div></div></div>'+
    '<div class="subtab-row">'+
    '<button class="subtab active" data-tab="t">Tasks</button>'+
    '<button class="subtab" data-tab="j">Journal ('+jn.length+')</button>'+
    '<button class="subtab" data-tab="v">Vocabulary ('+vc.length+')</button>'+
    '</div>'+
    '<div class="subview active" data-tab="t">'+buildTasks(name)+'</div>'+
    '<div class="subview" data-tab="j">'+buildJournal(name)+'</div>'+
    '<div class="subview" data-tab="v">'+buildVocab(name)+'</div>'+
    '</div>';
}

function buildTasks(name){
  const tk=D.tasks.filter(t=>t.Student===name);
  
  // Build a lookup of most recent status per task
  const taskStatus={};
  const sorted=[...tk].sort((a,b)=>new Date(parseTs(a.Timestamp))-new Date(parseTs(b.Timestamp)));
  sorted.forEach(t=>{
    const key=(t.Week||'')+'||'+(t.Task||'');
    taskStatus[key]={completed:t.Completed==='Completed',timestamp:t.Timestamp};
  });

  // Show ALL 12 weeks with all tasks
  return WEEKS_ALL.map(w=>{
    const wk='Week '+w.num;
    const taskRows=w.tasks.map(taskName=>{
      const key=wk+'||'+taskName;
      const status=taskStatus[key];
      const done=status&&status.completed;
      const ts=status&&status.timestamp?fmt(status.timestamp):'';
      return '<div class="task-row">'+
        '<div class="task-dot '+(done?'done':'undone')+'"></div>'+
        '<div class="task-info"><div class="task-name'+(done?' done':'')+'">'+esc(taskName)+'</div>'+
        '<div class="task-bottom">'+
        (ts?'<span class="task-time">'+(done?'Completed':'Last seen')+': '+ts+'</span>':'<span class="task-time" style="color:#ddd">Not started</span>')+
        '</div></div></div>';
    }).join('');

    const done=w.tasks.filter(t=>taskStatus['Week '+w.num+'||'+t]&&taskStatus['Week '+w.num+'||'+t].completed).length;
    const total=w.tasks.length;
    const wp=Math.round(done/total*100);
    const gid='g'+name.replace(/[^a-z0-9]/gi,'_')+'_w'+w.num;
    const bs=done===total?'background:#D1F2EB;color:#0E6655':done>0?'background:#FCF3CF;color:#7D6608':'background:#f0f0f0;color:#aaa';
    const bt=done===total?'Complete':done+'/'+total+' done';

    return '<div class="week-group">'+
      '<div class="wg-minibar-wrap"><div class="wg-minibar" style="width:'+wp+'%;background:'+(done===total?'#0E6655':'#1A5276')+'"></div></div>'+
      '<div class="wg-header" data-gid="'+gid+'"><div>'+
      '<div class="wg-title">Week '+w.num+'</div>'+
      '<div class="wg-theme">'+esc(w.theme)+'</div>'+
      '</div><div class="wg-right"><span class="wg-badge" style="'+bs+'">'+bt+'</span>'+
      '<span class="wg-chev" id="c-'+gid+'">&#8964;</span></div></div>'+
      '<div class="wg-body" id="'+gid+'">'+taskRows+'</div></div>';
  }).join('');
}

function buildJournal(name){
  const jn=D.journals.filter(j=>j.Student===name).sort((a,b)=>new Date(parseTs(b.Timestamp))-new Date(parseTs(a.Timestamp)));
  if(!jn.length)return '<div class="empty">No journal entries yet.</div>';
  const studentFeedback=D.feedback?D.feedback.filter(f=>f.Student===name):[];

  return jn.map((entry,i)=>{
    const id='je_'+name.replace(/[^a-z0-9]/gi,'_')+'_'+i;
    const week=esc(entry.Week||'');
    const theme=esc(entry.Theme||'');
    const text=esc(entry.Text||'');
    const wc=parseInt(entry.WordCount||0);
    const ts=fmt(entry.Timestamp);
    const fb=studentFeedback.find(f=>f.Week===entry.Week&&f.EntryIndex===String(i));
    const fbText=fb?fb.FeedbackText:'';
    const fbGrade=fb?fb.Grade:'';
    const fbPublished=fb?fb.Published==='Yes':false;
    const fbId='fb_'+name.replace(/[^a-z0-9]/gi,'_')+'_'+i;

    return '<div class="journal-entry" data-student="'+esc(name)+'" data-week="'+esc(entry.Week||'')+'" data-idx="'+i+'">'+
      '<div class="je-meta"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'+
      '<span class="je-week">'+week+'</span>'+(theme?'<span class="je-theme">'+theme+'</span>':'')+
      '</div><div style="display:flex;align-items:center;gap:8px">'+
      (wc?'<span class="je-wc">'+wc+' words</span>':'')+
      '<span class="je-date">'+ts+'</span></div></div>'+
      '<div class="je-text" id="'+id+'">'+text+'</div>'+
      '<span class="je-expand" data-id="'+id+'">Show full entry</span>'+
      '<div class="fb-section">'+
      '<div class="fb-header">'+
        (fbPublished?'<span class="fb-status published">Feedback published</span>':'<span class="fb-status draft">Draft feedback</span>')+
      '</div>'+
      '<div class="fb-controls">'+
        '<div class="fb-grade-row">'+
          '<label class="fb-label">Grade:</label>'+
          '<select class="fb-grade" id="grade_'+fbId+'" data-fbid="'+fbId+'">'+
            '<option value="">-- Select --</option>'+
            '<option value="Excellent"'+(fbGrade==='Excellent'?' selected':'')+'>Excellent</option>'+
            '<option value="Good"'+(fbGrade==='Good'?' selected':'')+'>Good</option>'+
            '<option value="Developing"'+(fbGrade==='Developing'?' selected':'')+'>Developing</option>'+
          '</select>'+
          '<button class="fb-ai-btn" data-fbid="'+fbId+'" data-idx="'+i+'" data-week="'+esc(entry.Week||'')+'">✨ AI suggestion</button>'+
        '</div>'+
        '<textarea class="fb-textarea" id="text_'+fbId+'" data-fbid="'+fbId+'" placeholder="Write your feedback here...">'+esc(fbText)+'</textarea>'+
        '<div class="fb-btn-row">'+
          '<span class="fb-saved-msg" id="saved_'+fbId+'"></span>'+
          '<button class="fb-publish-btn'+(fbPublished?' published':'')+'" data-fbid="'+fbId+'" data-published="'+fbPublished+'">'+
            (fbPublished?'✓ Published':'Publish feedback')+
          '</button>'+
        '</div>'+
      '</div>'+
      '</div>'+
      '</div>';
  }).join('');
}


function buildVocab(name){
  const vc=D.vocab.filter(v=>v.Student===name);
  if(!vc.length)return '<div class="empty">No vocabulary activity yet.</div>';
  const by={};
  vc.forEach(v=>{const wk=v.Week||'Week ?';if(!by[wk])by[wk]=new Set();by[wk].add(v.Word||'');});
  return Object.keys(by).sort((a,b)=>(parseInt(a.replace(/[^0-9]/g,''))||0)-(parseInt(b.replace(/[^0-9]/g,''))||0)).map(wk=>{
    const words=[...by[wk]].filter(Boolean);
    return '<div style="margin-bottom:1.25rem">'+
      '<div style="font-size:12px;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">'+
      esc(wk)+' &nbsp;·&nbsp; '+words.length+' words studied</div>'+
      '<div class="vocab-grid">'+words.map(w=>'<div class="vocab-card"><div class="vc-word">'+esc(w)+'</div></div>').join('')+'</div></div>';
  }).join('');
}

function lastActive(name){
  const all=[...D.tasks,...D.journals,...D.vocab].filter(r=>r.Student===name).map(r=>{
    try{return parseTs(r.Timestamp);}catch(x){return null;}
  }).filter(d=>d&&!isNaN(d));
  return all.length?new Date(Math.max(...all)):null;
}
function dot(name){const la=lastActive(name);if(!la)return 'dot-none';const h=(Date.now()-la)/3600000;return h<24?'dot-active':h<72?'dot-recent':'dot-inactive';}
function statusLabel(name){const la=lastActive(name);if(!la)return 'No activity yet';const h=(Date.now()-la)/3600000;return h<24?'Active today':h<72?'Active recently':'Not active in 3+ days';}

setInterval(loadData,30000);
loadData();
</script>
</body>
</html>`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
module.exports = app;
