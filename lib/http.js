export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const k in headers) res.setHeader(k, headers[k]);
  res.end(JSON.stringify(body));
}
export async function body(req) {
  let pre; try { pre = req.body; } catch (e) { throw new Error('bad json'); }
  if (pre && typeof pre === 'object') return pre;
  const chunks = [];
  for await (const c of req) { chunks.push(c); if (chunks.reduce((a, b) => a + b.length, 0) > 64 * 1024) throw new Error('too large'); }
  const s = Buffer.concat(chunks).toString('utf8');
  return s ? JSON.parse(s) : {};
}
