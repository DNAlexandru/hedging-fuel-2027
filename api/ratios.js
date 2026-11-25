import { session, sameApp } from '../lib/auth.js';
import { send, body } from '../lib/http.js';
import { update, STATE } from '../lib/store.js';
import { SEED_STATE } from '../lib/seed.js';

export default async function handler(req, res) {
  if (!session(req)) return send(res, 401, { error: 'Accesso richiesto.' });
  if (!sameApp(req)) return send(res, 403, { error: 'Richiesta non valida.' });
  if (req.method !== 'PUT') return send(res, 405, { error: 'Metodo non ammesso.' });
  let b; try { b = await body(req); } catch { return send(res, 400, { error: 'Richiesta non valida.' }); }
  const r = Array.isArray(b.ratios) && b.ratios.length === 4 && b.ratios.every(v => typeof v === 'number' && v > 0 && v < 100) ? b.ratios : null;
  if (!r) return send(res, 400, { error: 'Rapporti non validi.' });
  const out = await update(STATE, st => { st.ratios = r.map(v => Math.round(v * 1000) / 1000); st.rev = (st.rev || 0) + 1; }, () => JSON.parse(JSON.stringify(SEED_STATE)));
  if (out.error) return send(res, 409, { error: out.error });
  return send(res, 200, { state: out.data, etag: out.etag });
}
