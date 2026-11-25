import crypto from 'node:crypto';
import { session, sameApp } from '../lib/auth.js';
import { send, body } from '../lib/http.js';
import { update, STATE } from '../lib/store.js';
import { SEED_STATE } from '../lib/seed.js';
import { cleanRound } from '../lib/state.js';

const init = () => JSON.parse(JSON.stringify(SEED_STATE));

export default async function handler(req, res) {
  const s = session(req);
  if (!s) return send(res, 401, { error: 'Accesso richiesto.' });
  if (!sameApp(req)) return send(res, 403, { error: 'Richiesta non valida.' });
  const id = new URL(req.url, 'http://x').searchParams.get('id');
  let b = {};
  if (req.method !== 'DELETE') { try { b = await body(req); } catch { return send(res, 400, { error: 'Richiesta non valida.' }); } }

  let out;
  if (req.method === 'POST') {
    const c = cleanRound(b, s.name);
    if (c.error) return send(res, 400, { error: c.error });
    out = await update(STATE, st => {
      let n = 0;
      for (const r of st.rounds) { const m = /(\d+)\s*$/.exec(r.nome || ''); if (m) n = Math.max(n, +m[1]); }
      const r = { id: crypto.randomUUID().slice(0, 12), nome: 'Round ' + (n + 1), ...c.round };
      st.rounds.push(r); st.rev = (st.rev || 0) + 1;
      return { nome: r.nome };
    }, init);
  } else if (req.method === 'DELETE') {
    if (!id) return send(res, 400, { error: 'Round non indicato.' });
    out = await update(STATE, st => {
      const r = st.rounds.find(x => x.id === id);
      if (!r) return { error: 'Il round non esiste più: forse l’ha già eliminato un collega.' };
      st.rounds = st.rounds.filter(x => x.id !== id); st.rev = (st.rev || 0) + 1;
      return { nome: r.nome };
    }, init);
  } else if (req.method === 'PATCH') {
    /* Aggiunge o corregge il Brent di un round già salvato; tonnellate e prezzi non si modificano. */
    if (!id) return send(res, 400, { error: 'Round non indicato.' });
    const q = Number(b.q), v = Number(b.b);
    if (!(q >= 0 && q <= 3) || !(v > 0 && v < 1000)) return send(res, 400, { error: 'Scrivi il Brent in $/barile, per esempio 92,5.' });
    out = await update(STATE, st => {
      const r = st.rounds.find(x => x.id === id);
      if (!r) return { error: 'Il round non esiste più.' };
      if (!(r.t[q] > 0)) return { error: 'In quel trimestre il round non ha tonnellate.' };
      r.b = Array.isArray(r.b) ? r.b : [null, null, null, null];
      r.b[q] = Math.round(v * 1000) / 1000; st.rev = (st.rev || 0) + 1;
      return { nome: r.nome };
    }, init);
  } else return send(res, 405, { error: 'Metodo non ammesso.' });

  if (out.error) return send(res, 409, { error: out.error });
  if (out.result && out.result.error) return send(res, 409, { error: out.result.error });
  return send(res, 200, { state: out.data, etag: out.etag, nome: out.result && out.result.nome });
}
