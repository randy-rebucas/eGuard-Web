# Code signing for eGuard for Windows

What's needed to sign the Windows desktop agent ([desktop-agent-spec.md](desktop-agent-spec.md)) before it ships. If
it's unsigned, Windows SmartScreen warns on every install, and Microsoft Defender may flag a service that ends other
processes.

**Status (2026-10-23):** not bought yet. The D-U-N-S number is ready.

## Decision

Buy an **OV (Organization Validation) code-signing certificate with cloud signing**.

| Option | Why not, or why |
|---|---|
| Azure Artifact Signing (formerly Trusted Signing), about $10 a month | **Not available to us.** It's open to organizations in the US, Canada, the EU and the UK, and to individuals in the US and Canada only |
| EV certificate | **Not worth the extra cost.** Since 2024 it no longer skips SmartScreen: EV and OV files build reputation the same way. EV is only needed for kernel drivers, and the agent has none |
| OV certificate on a USB token | It works, but the token has to be shipped here and can't sign in an automated build |
| **OV certificate with cloud signing** | **Chosen.** The key stays in the certificate authority's secure server and you sign over its API. It works from a build server, and nothing is shipped |

Providers with cloud signing (check prices on their sites before buying):

- **Certum SimplySign**: usually the cheapest.
- **SSL.com eSigner**
- **DigiCert KeyLocker**: costs more.

Expect roughly $200–500 a year, sometimes plus a cloud-signing fee.

**Validity:** at most 460 days (about 15 months) for certificates issued from March 1, 2026, so it **renews every year**.

## Business details

| | |
|---|---|
| D-U-N-S number | 728631102 |
| Business name (as on the certificate) | _fill in: exactly as on the DTI or SEC registration_ |
| Registration | _fill in: DTI (sole proprietorship) or SEC (corporation), with number_ |

The certificate shows the **registered business name** to parents as the publisher when they install eGuard. Don't
use an individual certificate: it would show a personal name.

## Checklist

1. **Check the D&B record** (Dun & Bradstreet's site). The business name, address and phone must match the DTI or SEC
   papers exactly; "Inc." versus "Inc" is enough to stall validation. The phone must be listed and answered, because
   the certificate authority calls it. If anything is off, ask D&B to correct it first; that can take a few days to a
   couple of weeks.
2. **Buy the OV certificate with cloud signing** from one of the providers above. Choose an RSA key of 3072 bits or
   more. Give them:
   - the registered business name
   - the D-U-N-S number
   - the registration documents
   - the listed phone number
3. **Pass validation.** The provider reviews the documents and calls the listed number. It takes a few days to two
   weeks, so **start 3–4 weeks before the Windows beta.**
4. **Hand over the setup for the build:** which provider, and the publisher name exactly as it appears on the
   certificate. **Never** put the password, one-time codes or API secrets in chat, a commit or a doc. They go in the
   build system's secret store or environment variables.
5. **Wire signing into the agent's build** (Claude can do this step):
   - Sign every `.exe` and `.dll` and the MSI with `signtool`, through the provider's cloud signing tool.
   - Always add an RFC 3161 timestamp, so signatures stay valid after the certificate expires.
   - Tauri and WiX both take a custom sign command.
   - Document it in desktop-agent-spec.md.
6. **After release:**
   - Keep the same certificate and publisher name across releases, because SmartScreen reputation builds on them.
   - Start with a small beta group.
   - If Defender flags the agent, submit the files to Microsoft's malware submission portal as a false positive.
7. **Every year:** renew before the certificate expires, and expect to pass validation again.

## Sources

- [Microsoft: code signing options for Windows apps](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)
- [Azure Artifact Signing FAQ](https://learn.microsoft.com/en-us/azure/artifact-signing/faq)
- [460-day validity from March 1, 2026](https://sslinsights.com/code-signing-certificate-validity-reduced-460-days/)
- [EV certificates no longer give instant SmartScreen reputation](https://www.todesktop.com/blog/posts/windows-apps-psa-ev-certs-do-not-grant-immediate-reputation-anymore)
