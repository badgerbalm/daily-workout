Attempting to perform the InitializeDefaultDrives operation on the 'FileSystem' provider failed.
const APP_ORIGIN = 'https://badgerbalm.github.io';
const AUTH_URL = 'https://daily-workout-auth.onlinesny.workers.dev/session';
const OWNER_EMAIL = 'onlinesny@gmail.com';
const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const unb64 = value => {
  const encoded = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(encoded + '='.repeat((4 - encoded.length % 4) % 4)), c => c.charCodeAt(0));
};
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

async function ownerSession(request, env) {
  const token = request.headers.get('Authorization');
  if (!token || !/^Bearer [A-Za-z0-9_-]{43}$/.test(token)) throw new HttpError(401, 'Connect Google in Daily Workout to view your private donation log.');
  const checked = await env.AUTH_SERVICE.fetch(AUTH_URL, { headers: { Authorization: token, Origin: APP_ORIGIN } });
  if (!checked.ok) throw new HttpError(401, 'Your Google connection needs renewal. Reconnect in Daily Workout.');
  const identity = await checked.json();
  if (identity.email !== OWNER_EMAIL) throw new HttpError(403, 'This donation log is private to its owner.');
}

async function dataKey(env, usage = ['encrypt', 'decrypt']) {
  if (!env.DONATION_DATA_KEY) throw new HttpError(503, 'Donation data encryption is not configured.');
  return crypto.subtle.importKey('raw', unb64(env.DONATION_DATA_KEY), { name: 'AES-GCM' }, false, usage);
}

async function seal(value, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await dataKey(env, ['encrypt']), enc.encode(value));
  return b64(iv) + '.' + b64(ciphertext);
}

async function unseal(value, env) {
  const [iv, ciphertext] = value.split('.');
  if (!iv || !ciphertext) throw new HttpError(500, 'Stored donation record could not be read.');
  try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await dataKey(env, ['decrypt']), unb64(ciphertext))); }
  catch { throw new HttpError(500, 'Stored donation record could not be read.'); }
}

async function keyFor(value, env) {
  const key = await crypto.subtle.importKey('raw', unb64(env.DONATION_DATA_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function cleanRecord(input) {
  if (!input || !validDate(input.date) || (input.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time))) throw new HttpError(400, 'A visit has an invalid date or time.');
  const row = {
    id: String(input.id || (input.date + ' ' + (input.time || ''))), date: input.date, time: input.time || '',
    visitType: input.visitType || (input.source === 'Personal BP log' ? 'Other BP reading' : 'CSL donation'),
    arm: input.arm || '', notes: input.notes || '', source: input.source || 'Manual entry'
  };
  if (row.id.length > 200 || !['CSL donation', 'Doctor / clinic', 'Home reading', 'Other BP reading', 'Other'].includes(row.visitType) || !['', 'Left', 'Right', 'Both'].includes(row.arm) || typeof row.notes !== 'string' || row.notes.length > 2000) throw new HttpError(400, 'A visit has invalid type, arm, or notes.');
  for (const field of ['systolic', 'diastolic', 'pulse', 'weight', 'temperature', 'hematocrit', 'protein', 'duration']) {
    const value = input[field];
    const number = value === '' || value == null ? null : Number(value);
    const integer = ['systolic', 'diastolic', 'pulse'].includes(field);
    if (number !== null && (!Number.isFinite(number) || number < 0 || (integer && (!Number.isInteger(number) || number < 1 || number > 400)) || (field === 'hematocrit' && number > 100) || (field === 'protein' && (number < 5.5 || number > 9.5)) || (['weight', 'temperature'].includes(field) && number <= 0))) throw new HttpError(400, 'A visit contains an invalid ' + field + ' value.');
    row[field] = number;
  }
  if (row.systolic !== null && row.diastolic !== null && row.systolic <= row.diastolic) throw new HttpError(400, 'Systolic pressure must be higher than diastolic pressure.');
  if (typeof row.source !== 'string' || row.source.length > 100) throw new HttpError(400, 'A visit has an invalid source label.');
  return row;
}

async function readJson(request, limit = 2000000) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new HttpError(415, 'JSON required.');
  const text = await request.text();
  if (text.length > limit) throw new HttpError(413, 'Request too large.');
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'Invalid JSON.'); }
}

async function visits(request, env) {
  if (request.method === 'GET') {
    const rows = await env.DONATION_DB.prepare('SELECT payload_cipher FROM donation_visits').all();
    const records = await Promise.all((rows.results || []).map(async row => JSON.parse(await unseal(row.payload_cipher, env))));
    records.sort((a, b) => (b.date + ' ' + b.time).localeCompare(a.date + ' ' + a.time));
    return json({ records });
  }
  if (request.method === 'DELETE') {
    const body = await readJson(request, 5000);
    if (typeof body.id !== 'string' || !body.id || body.id.length > 200) throw new HttpError(400, 'Expected a visit ID.');
    const hashed = await keyFor(body.id, env);
    const result = await env.DONATION_DB.prepare('DELETE FROM donation_visits WHERE visit_key = ?').bind(hashed).run();
    return json({ deleted: (result.meta?.changes || 0) > 0 });
  }
  if (request.method === 'PUT') {
    const body = await readJson(request);
    if (!Array.isArray(body.records) || body.records.length > 20000) throw new HttpError(400, 'Expected a bounded records array.');
    const statements = [];
    if (body.replace === true) statements.push(env.DONATION_DB.prepare('DELETE FROM donation_visits'));
    for (const item of body.records) {
      const row = cleanRecord(item);
      const hashed = await keyFor(row.id, env);
      statements.push(env.DONATION_DB.prepare('INSERT INTO donation_visits (visit_key, payload_cipher) VALUES (?, ?) ON CONFLICT(visit_key) DO UPDATE SET payload_cipher = excluded.payload_cipher, updated_at = CURRENT_TIMESTAMP').bind(hashed, await seal(JSON.stringify(row), env)));
    }
    if (statements.length) await env.DONATION_DB.batch(statements);
    return json({ saved: body.records.length });
  }
  throw new HttpError(405, 'Method not allowed.');
}

async function medications(request, env) {
  if (request.method === 'GET') {
    const rows = await env.DONATION_DB.prepare('SELECT payload_cipher FROM donation_medications').all();
    const events = await Promise.all((rows.results || []).map(async row => JSON.parse(await unseal(row.payload_cipher, env))));
    events.sort((a, b) => a.date.localeCompare(b.date));
    return json({ events });
  }
  if (request.method === 'PUT') {
    const body = await readJson(request, 100000);
    if (!Array.isArray(body.events) || body.events.length > 100) throw new HttpError(400, 'Expected a bounded medication event list.');
    const statements = [env.DONATION_DB.prepare('DELETE FROM donation_medications')];
    for (const event of body.events) {
      if (!event || !validDate(event.date) || typeof event.label !== 'string' || !event.label.trim() || event.label.length > 500) throw new HttpError(400, 'A medication event has an invalid date or label.');
      const row = { date: event.date, label: event.label.trim() };
      statements.push(env.DONATION_DB.prepare('INSERT INTO donation_medications (event_key, payload_cipher) VALUES (?, ?)').bind(await keyFor(row.date + '|' + row.label, env), await seal(JSON.stringify(row), env)));
    }
    await env.DONATION_DB.batch(statements);
    return json({ saved: body.events.length });
  }
  throw new HttpError(405, 'Method not allowed.');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const cors = origin === APP_ORIGIN ? { 'Access-Control-Allow-Origin': APP_ORIGIN, 'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Vary': 'Origin' } : {};
    if (origin !== APP_ORIGIN) return json({ error: 'Origin not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (!env.DONATION_DB || !env.DONATION_DATA_KEY || !env.AUTH_SERVICE) throw new HttpError(503, 'Donation data service is not configured.');
      await ownerSession(request, env);
      const url = new URL(request.url);
      if (url.pathname === '/health' && request.method === 'GET') return json({ ok: true, service: 'donation-log-api' }, 200, cors);
      if (url.pathname === '/api/visits') return await visits(request, env).then(result => { for (const [key, value] of Object.entries(cors)) result.headers.set(key, value); return result; });
      if (url.pathname === '/api/medications') return await medications(request, env).then(result => { for (const [key, value] of Object.entries(cors)) result.headers.set(key, value); return result; });
      return json({ error: 'Not found.' }, 404, cors);
    } catch (error) {
      return json({ error: error instanceof HttpError ? error.message : 'The private donation data service is temporarily unavailable.' }, error instanceof HttpError ? error.status : 503, cors);
    }
  }
};

