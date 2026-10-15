/** "Chrome on Windows", "eGuard app on iOS": what a session or sign-in came from, for Settings › Security and emails. */
export function summarizeAgent(ua: string | null) {
  if (!ua) return "Unknown device";
  // The parent app sends "eGuard/1.0 (iPhone; iOS 18.1)" (docs/mobile-api.md › Headers)
  if (/^eGuard\//i.test(ua)) return `eGuard app on ${/Android/i.test(ua) ? "Android" : /iPhone|iPad|iOS/i.test(ua) ? "iOS" : "a phone"}`;
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}
