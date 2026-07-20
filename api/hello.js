export default async function handler(req) {
  return new Response(JSON.stringify({ ok: true, url: req.url, method: req.method }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
