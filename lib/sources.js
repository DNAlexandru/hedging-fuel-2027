import * as XLSX from 'xlsx';

export const EU_URL = 'https://energy.ec.europa.eu/document/download/906e60ca-8b6a-44e7-8589-652854d2fd3f_en?filename=Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx';
export const EU_MIRROR = 'https://raw.githubusercontent.com/fuel-prices-eu/european-fuel-prices/main/sample/fp-d1-eu-weighted-average_sample.csv';
export const BRENT_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU&cosd=2025-01-01';
export const FX_URL = 'https://api.frankfurter.dev/v1/latest?from=EUR&to=USD';

const UA = { 'User-Agent': 'Mozilla/5.0 (hedging-dashboard; weekly update)' };
function iso(d) { return d.toISOString().slice(0, 10); }
function serialToIso(v) {
  if (typeof v === 'number') return iso(new Date(Math.round((v - 25569) * 864e5)));
  if (v instanceof Date) return iso(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())));
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  if (typeof v === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(v)) { const [d, m, y] = v.split('/'); return `${y}-${m}-${d}`; }
  return null;
}
async function fetchT(url, ms = 25000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, { headers: UA, signal: ac.signal, redirect: 'follow' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r; }
  finally { clearTimeout(t); }
}

/* Bollettino UE ufficiale: foglio "Prices with taxes", colonna D = media ponderata EU-27 del diesel (€/1000 L). */
export function parseEuXlsx(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets['Prices with taxes'];
  if (!ws) throw new Error('foglio "Prices with taxes" mancante');
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  const head = (rows[0] || []).map(x => String(x || ''));
  const col = head.findIndex(h => /EU_price_with_tax_diesel/i.test(h));
  if (col < 0) throw new Error('colonna EU_price_with_tax_diesel mancante');
  const out = [];
  for (const r of rows.slice(3)) {
    const d = serialToIso(r[0]), v = r[col];
    if (d && typeof v === 'number' && v > 300 && v < 5000) out.push([d, Math.round(v * 100) / 100]);
  }
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}
export function parseEuMirror(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const c = line.split(',');
    if (c[0] === 'EU27' && /^\d{4}-\d{2}-\d{2}$/.test(c[1])) { const v = parseFloat(c[3]) * 1000; if (v > 300 && v < 5000) out.push([c[1], Math.round(v * 100) / 100]); }
  }
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}
export function parseFred(text) {
  const out = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    const [d, v] = line.split(',');
    const x = parseFloat(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && isFinite(x) && x > 5) out.push([d, x]);
  }
  return out;
}
export async function getEu() {
  try {
    const r = await fetchT(EU_URL, 40000);
    const rows = parseEuXlsx(Buffer.from(await r.arrayBuffer()));
    if (rows.length < 10) throw new Error('troppe poche righe');
    return { rows, source: 'Bollettino UE (file ufficiale)' };
  } catch (e1) {
    const r = await fetchT(EU_MIRROR);
    const rows = parseEuMirror(await r.text());
    if (!rows.length) throw new Error('fonte ufficiale: ' + e1.message + '; copia: nessun dato');
    return { rows, source: 'Bollettino UE (copia fuel-prices.eu; file ufficiale non raggiungibile: ' + e1.message + ')' };
  }
}
export async function getBrent() {
  const r = await fetchT(BRENT_URL);
  const rows = parseFred(await r.text());
  if (!rows.length) throw new Error('nessun dato');
  return { rows, source: 'EIA, Brent Europe spot (serie FRED DCOILBRENTEU)' };
}
export async function getFx() {
  const r = await fetchT(FX_URL);
  const j = await r.json();
  if (!(j && j.rates && j.rates.USD)) throw new Error('nessun dato');
  return { d: j.date, usd: j.rates.USD, source: 'BCE (via Frankfurter)' };
}
