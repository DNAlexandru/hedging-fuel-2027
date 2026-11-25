import { get, put, head } from '@vercel/blob';

export const STATE = 'data/state.json';
export const MARKET = 'data/market.json';

export async function readJson(path, ifNoneMatch) {
  const r = await get(path, { access: 'private', useCache: false, ...(ifNoneMatch ? { ifNoneMatch } : {}) });
  if (!r) return { data: null, etag: null };
  if (r.statusCode === 304) return { data: null, etag: ifNoneMatch, unchanged: true };
  const text = await new Response(r.stream).text();
  return { data: JSON.parse(text), etag: r.blob.etag };
}
export async function writeJson(path, data, etag) {
  const res = await put(path, JSON.stringify(data), {
    access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
    cacheControlMaxAge: 60, ...(etag ? { ifMatch: etag } : {}),
  });
  return res.etag;
}
async function apiEtag(path) {
  try { return (await head(path)).etag || null; }
  catch (e) { if (/not.?found/i.test(String(e && (e.name || '') + ' ' + (e.message || '')))) return null; throw e; }
}
function isPrecondition(e) {
  const name = e && (e.name || e.constructor && e.constructor.name);
  return name === 'BlobPreconditionFailedError' || /precondition/i.test(String(e && e.message));
}
/* Legge, modifica e riscrive con controllo di versione (etag dell'API, non quello della CDN):
   se un altro utente ha scritto nel frattempo, rilegge e riprova. */
export async function update(path, change, init) {
  for (let i = 0; i < 6; i++) {
    const last = i === 5;
    const etag = last ? null : await apiEtag(path);
    const cur = await readJson(path);
    const data = cur.data || init();
    const result = change(data);
    if (result && result.error) return result;
    try {
      await writeJson(path, data, etag);
      return { data, etag: null, result };
    } catch (e) {
      if (!last && isPrecondition(e)) { await new Promise(r => setTimeout(r, 150 + Math.random() * 300)); continue; }
      throw e;
    }
  }
  return { error: 'Troppe modifiche contemporanee: riprova.' };
}
