import { passwordOk, sessionCookie, clearCookie, session, sameApp } from '../lib/auth.js';
import { send, body } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'GET') { const s = session(req); return send(res, 200, { logged: !!s, name: s ? s.name : '' }); }
  if (!sameApp(req)) return send(res, 403, { error: 'Richiesta non valida.' });
  if (req.method === 'DELETE') return send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
  if (req.method !== 'POST') return send(res, 405, { error: 'Metodo non ammesso.' });
  let b; try { b = await body(req); } catch { return send(res, 400, { error: 'Richiesta non valida.' }); }
  if (!passwordOk(b.password)) {
    await new Promise(r => setTimeout(r, 800));
    return send(res, 401, { error: 'Password errata.' });
  }
  return send(res, 200, { ok: true, name: String(b.name || '').trim().slice(0, 40) }, { 'Set-Cookie': sessionCookie(b.name) });
}
