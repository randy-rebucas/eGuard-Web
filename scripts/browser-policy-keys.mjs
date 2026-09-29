// Generates the key pair that signs browser policies.
//   node scripts/browser-policy-keys.mjs
// Put the private key in the server's environment and the public key in the extension build's (eguard-browser/.env).
// Rotating it means shipping an extension update with the new public key first.
import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const priv = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
const pub = publicKey.export({ format: "der", type: "spki" }).toString("base64");

console.log("# eGuard server (.env / .env.local). Keep secret.");
console.log(`BROWSER_POLICY_SIGNING_KEY=${priv}`);
console.log("");
console.log("# eGuard browser extension build (eguard-browser/.env). Public.");
console.log(`VITE_POLICY_PUBLIC_KEY=${pub}`);
