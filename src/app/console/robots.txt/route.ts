/** console.eguard.family/robots.txt: nothing on this host is for search engines. */
export function GET() {
  return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
