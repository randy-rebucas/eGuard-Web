// Generates eGuard icons and logo files from a single SVG source.
// Usage: node scripts/generate-brand.mjs
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const SHIELD = "M32 4C24.4 8 16.4 10.2 8.5 11.2V30c0 14.6 9.8 25.4 23.5 30 13.7-4.6 23.5-15.4 23.5-30V11.2C47.6 10.2 39.6 8 32 4Z";
const inset = (s) => `translate(32 32) scale(${s}) translate(-32 -32)`;

// The shield mark on a 64×64 grid. `p` prefixes gradient ids so several marks can share a document.
export function mark(p = "eg") {
  return `<defs>
    <linearGradient id="${p}-o" x1="10" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4FD2FF"/><stop offset=".55" stop-color="#2394F5"/><stop offset="1" stop-color="#1560DB"/></linearGradient>
    <linearGradient id="${p}-i" x1="18" y1="16" x2="46" y2="50" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8BE0FF"/><stop offset="1" stop-color="#2B8EF2"/></linearGradient>
  </defs>
  <path d="${SHIELD}" fill="url(#${p}-o)"/>
  <path d="${SHIELD}" fill="#fff" transform="${inset(0.76)}"/>
  <path d="${SHIELD}" fill="url(#${p}-i)" transform="${inset(0.6)}"/>
  <g stroke-linejoin="round" stroke-width="1.2">
    <path d="M32 22.5 40.2 27.2 32 31.9 23.8 27.2Z" fill="#C4F0FF" stroke="#C4F0FF"/>
    <path d="M23.8 27.2 32 31.9V41.3L23.8 36.6Z" fill="#1E9BF2" stroke="#1E9BF2"/>
    <path d="M40.2 27.2 32 31.9V41.3L40.2 36.6Z" fill="#0B5FD4" stroke="#0B5FD4"/>
  </g>`;
}

const svg = (w, h, body, vb = `0 0 ${w} ${h}`) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}">${body}</svg>\n`;
const FONT = `font-family="Sora, 'Hanken Grotesk', 'Segoe UI', Roboto, Arial, sans-serif"`;

const markSvg = svg(64, 64, mark());
// Mark on a soft brand background for platforms that don't allow transparency (iOS, app stores).
const tile = () => svg(64, 64, `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCEEFF"/></linearGradient></defs>
  <rect width="64" height="64" fill="url(#bg)"/><g transform="${inset(0.78)}">${mark()}</g>`, "0 0 64 64");

const horizontal = (ink) => svg(240, 64, `${mark()}<text x="76" y="44" ${FONT} font-size="38" font-weight="700" letter-spacing="-1" fill="${ink}">eGuard</text>`);
const full = (ink, sub) => svg(400, 96, `<g transform="scale(1.5)">${mark()}</g>
  <text x="112" y="54" ${FONT} font-size="52" font-weight="700" letter-spacing="-1.5" fill="${ink}">eGuard</text>
  <text x="114" y="80" ${FONT} font-size="16" font-weight="500" fill="${sub}">Digital Safety for Brighter Tomorrows</text>`);

const png = (src, size) => sharp(Buffer.from(src), { density: (72 * size) / 64 }).resize(size, size).png().toBuffer();

// ICO container holding PNG frames (supported by every current browser).
function ico(frames) {
  const head = Buffer.alloc(6 + frames.length * 16);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(frames.length, 4);
  let offset = head.length;
  frames.forEach(({ size, data }, i) => {
    const o = 6 + i * 16;
    head.writeUInt8(size % 256, o);
    head.writeUInt8(size % 256, o + 1);
    head.writeUInt16LE(1, o + 4);
    head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(data.length, o + 8);
    head.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...frames.map((f) => f.data)]);
}

await mkdir("public/brand", { recursive: true });
const sizes = [16, 32, 48];
const frames = await Promise.all(sizes.map(async (size) => ({ size, data: await png(markSvg, size) })));

await Promise.all([
  writeFile("src/app/icon.svg", markSvg),
  writeFile("src/app/favicon.ico", ico(frames)),
  png(tile(), 180).then((b) => writeFile("src/app/apple-icon.png", b)),
  writeFile("public/brand/logo-mark.svg", markSvg),
  writeFile("public/brand/logo-horizontal.svg", horizontal("#0B2348")),
  writeFile("public/brand/logo-horizontal-dark.svg", horizontal("#FFFFFF")),
  writeFile("public/brand/logo-full.svg", full("#0B2348", "#62769A")),
  writeFile("public/brand/logo-full-dark.svg", full("#FFFFFF", "#B6C7E0")),
  png(markSvg, 512).then((b) => writeFile("public/brand/logo-mark-512.png", b)),
  png(tile(), 1024).then((b) => writeFile("public/brand/app-icon-1024.png", b)),
]);
console.log("Brand assets written to src/app and public/brand");
