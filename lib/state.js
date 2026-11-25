/* Stato condiviso: round, rapporti di riserva, parametri di budget. */
export function initState() {
  return { rounds: [], ratios: [11.7, 11.7, 11.7, 11.7], params: null, rev: 0 };
}
const ISO = /^\d{4}-\d{2}-\d{2}$/;
function nums(a, max) {
  return [0, 1, 2, 3].map(i => {
    const v = Array.isArray(a) ? a[i] : null;
    return (typeof v === 'number' && isFinite(v) && v > 0 && v < max) ? Math.round(v * 1000) / 1000 : null;
  });
}
/* Controlla un round inviato dalla pagina. Restituisce {round} oppure {error}. */
export function cleanRound(src, who) {
  const t = nums(src.t, 100000), p = nums(src.p, 100000), b = nums(src.b, 1000);
  const data = typeof src.data === 'string' && ISO.test(src.data) ? src.data : null;
  if (!data) return { error: 'Data del round non valida.' };
  let any = false;
  for (let i = 0; i < 4; i++) {
    if ((t[i] && !p[i]) || (p[i] && !t[i])) return { error: 'Per ogni trimestre servono sia le tonnellate sia il prezzo.' };
    if (b[i] && !t[i]) return { error: 'Il Brent va indicato solo nei trimestri con tonnellate.' };
    if (t[i]) any = true;
  }
  if (!any) return { error: 'Scrivi tonnellate e prezzo per almeno un trimestre.' };
  return { round: { t, p, b, data, da: String(who || '').slice(0, 40), creato: new Date().toISOString() } };
}
