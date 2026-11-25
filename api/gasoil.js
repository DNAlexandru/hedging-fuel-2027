import { session, sameApp } from '../lib/auth.js';
import { send, body } from '../lib/http.js';
import { update, MARKET } from '../lib/store.js';
import { SEED_MARKET } from '../lib/seed.js';

/* Quotazione settimanale del future gasoil inserita a mano (non esiste una fonte gratuita ufficiale). */
export default async function handler(req, res) {
  const s = session(req);
  if (!s) return send(res, 401, { error: 'Accesso richiesto.' });
  if (!sameApp(req)) return send(res, 403, { error: 'Richiesta non valida.' });
  const init = () => JSON.parse(JSON.stringify(SEED_MARKET));
  let out;
  if (req.method === 'POST') {
    let b; try { b = await body(req); } catch { return send(res, 400, { error: 'Richiesta non valida.' }); }
    const d = /^\d{4}-\d{2}-\d{2}$/.test(String(b.d)) ? b.d : null, v = Number(b.eur);
    if (!d || !(v > 100 && v < 5000)) return send(res, 400, { error: 'Servono data e prezzo in €/t (tra 100 e 5.000).' });
    const src = 'inserito' + (s.name ? ' da ' + s.name : '');
    out = await update(MARKET, m => {
      m.gasoil = (m.gasoil || []).filter(x => x[0] !== d);
      m.gasoil.push([d, Math.round(v * 100) / 100, src]);
      m.gasoil.sort((a, b) => a[0].localeCompare(b[0]));
    }, init);
  } else if (req.method === 'DELETE') {
    const d = new URL(req.url, 'http://x').searchParams.get('d');
    out = await update(MARKET, m => {
      const before = (m.gasoil || []).length;
      m.gasoil = (m.gasoil || []).filter(x => !(x[0] === d && !/Bloomberg/.test(x[2] || '')));
      if (m.gasoil.length === before) return { error: 'Valore non trovato (i dati Bloomberg non si eliminano).' };
    }, init);
  } else return send(res, 405, { error: 'Metodo non ammesso.' });
  if (out.error) return send(res, 409, { error: out.error });
  if (out.result && out.result.error) return send(res, 409, { error: out.result.error });
  return send(res, 200, { market: out.data });
}
