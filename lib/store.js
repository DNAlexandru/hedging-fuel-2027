import { get, put } from '@vercel/blob';

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
/* Legge, modifica e riscrive con controllo di versione: se un altro utente ha scritto nel frattempo, riprova. */
export async function update(path, change, init) {
  for (let i = 0; i < 5; i++) {
    const cur = await readJson(path);
    const data = cur.data || init();
    const result = change(data);
    if (result && result.error) return result;
    try {
      const etag = await writeJson(path, data, cur.etag);
      return { data, etag, result };
    } catch (e) {
      const name = e && (e.name || e.constructor && e.constructor.name);
      if (name === 'BlobPreconditionFailedError' || /precondition/i.test(String(e && e.message))) {
        await new Promise(r => setTimeout(r, 150 + Math.random() * 300));
        continue;
      }
      throw e;
    }
  }
  return { error: 'Troppe modifiche contemporanee: riprova.' };
}
