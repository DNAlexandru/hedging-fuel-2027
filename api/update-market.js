import crypto from 'node:crypto';
import { send } from '../lib/http.js';
import { update, readJson, MARKET } from '../lib/store.js';
import { SEED_MARKET } from '../lib/seed.js';
import { getEu, getBrent, getFx } from '../lib/sources.js';

function cronOk(req) {
  const secret = process.env.CRON_SECRET; if (!secret) return false;
  const h = String(req.headers.authorization || '');
  const q = new URL(req.url, 'http://x').searchParams.get('key') || '';
  const eq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  return eq(h, 'Bearer ' + secret) || eq(q, secret);
}
function merge(oldRows, newRows, from) {
  const m = new Map((oldRows || []).map(r => [r[0], r]));
  for (const r of newRows) m.set(r[0], r);
  return [...m.values()].filter(r => r[0] >= from).sort((a, b) => a[0].localeCompare(b[0]));
}

export default async function handler(req, res) {
  try { return await run(req, res); }
  catch (e) { console.error('update-market', e); return send(res, 500, { error: 'Aggiornamento non riuscito: ' + String(e && e.message || e).slice(0, 300) }); }
}
async function run(req, res) {
  const cron = cronOk(req);
  if (!cron) {
    const cur = await readJson(MARKET);
    const at = cur.data && cur.data.status && cur.data.status.at;
    if (at && Date.now() - Date.parse(at) < 20 * 60e3) return send(res, 200, { market: cur.data, skipped: true });
  }
  const [eu, brent, fx] = await Promise.allSettled([getEu(), getBrent(), getFx()]);
  const now = new Date().toISOString();
  const out = await update(MARKET, m => {
    m.status = m.status || {};
    m.status.at = now;
    if (eu.status === 'fulfilled') { m.eu = merge(m.eu, eu.value.rows, '2024-01-01'); m.status.eu = { ok: true, at: now, source: eu.value.source, last: m.eu[m.eu.length - 1][0] }; }
    else m.status.eu = { ...(m.status.eu || {}), ok: false, at: now, err: String(eu.reason && eu.reason.message || eu.reason) };
    if (brent.status === 'fulfilled') { m.brent = merge(m.brent, brent.value.rows, '2025-01-01'); m.status.brent = { ok: true, at: now, source: brent.value.source, last: m.brent[m.brent.length - 1][0] }; }
    else m.status.brent = { ...(m.status.brent || {}), ok: false, at: now, err: String(brent.reason && brent.reason.message || brent.reason) };
    if (fx.status === 'fulfilled') { m.fx = { d: fx.value.d, usd: fx.value.usd }; m.status.fx = { ok: true, at: now, source: fx.value.source, last: fx.value.d }; }
    else m.status.fx = { ...(m.status.fx || {}), ok: false, at: now, err: String(fx.reason && fx.reason.message || fx.reason) };
  }, () => JSON.parse(JSON.stringify(SEED_MARKET)));
  if (out.error) return send(res, 409, { error: out.error });
  return send(res, 200, { market: cron ? undefined : out.data, status: out.data.status });
}
