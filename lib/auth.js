import crypto from 'node:crypto';

const COOKIE = 'hsess';
const DAYS = 30;

function sign(payload) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || '').update(payload).digest('base64url');
}
function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
export function sessionCookie(name) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + DAYS * 864e5, n: String(name || '').trim().slice(0, 40) })).toString('base64url');
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`;
}
export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
export function session(req) {
  if (!process.env.SESSION_SECRET) return null;
  const raw = cookies(req)[COOKIE];
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  const good = sign(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try {
    const o = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return o.exp > Date.now() ? { name: o.n || '' } : null;
  } catch { return null; }
}
export function passwordOk(pw) {
  const want = process.env.APP_PASSWORD;
  if (!want) return false;
  const a = crypto.createHash('sha256').update(String(pw || '')).digest();
  const b = crypto.createHash('sha256').update(want).digest();
  return crypto.timingSafeEqual(a, b);
}
/* Le richieste che modificano dati devono arrivare dalla pagina stessa (JSON + intestazione propria). */
export function sameApp(req) {
  return req.headers['x-hedging'] === '1' && /application\/json/.test(String(req.headers['content-type'] || ''));
}
