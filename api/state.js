import { session } from '../lib/auth.js';
import { send } from '../lib/http.js';
import { readJson, STATE, MARKET } from '../lib/store.js';
import { SEED_STATE, SEED_MARKET } from '../lib/seed.js';

export default async function handler(req, res) {
  if (!session(req)) return send(res, 401, { error: 'Accesso richiesto.' });
  if (req.method !== 'GET') return send(res, 405, { error: 'Metodo non ammesso.' });
  const url = new URL(req.url, 'http://x');
  const v = url.searchParams.get('v') || undefined;
  const s = await readJson(STATE, v);
  const out = {};
  if (s.unchanged) out.unchanged = true;
  else { out.state = s.data || SEED_STATE; out.etag = s.etag || 'seed'; }
  if (url.searchParams.get('market') === '1') {
    const m = await readJson(MARKET);
    out.market = m.data || SEED_MARKET;
  }
  return send(res, 200, out);
}
