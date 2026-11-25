/* Accesso libero: chi ha il link può vedere e modificare (scelta del team, nessuna password). */
export function session() {
  return { name: '' };
}
/* Le richieste che modificano dati devono arrivare dalla pagina stessa (JSON + intestazione propria). */
export function sameApp(req) {
  return req.headers['x-hedging'] === '1' && /application\/json/.test(String(req.headers['content-type'] || ''));
}
