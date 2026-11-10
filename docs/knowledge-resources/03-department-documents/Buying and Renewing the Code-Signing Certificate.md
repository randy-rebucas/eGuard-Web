# Buying and Renewing the Code-Signing Certificate

## Summary

The code-signing procedure describes how DevCom Digital Marketing Services buys, sets up and renews the code-signing certificate used to sign eGuard for Windows. It is for the owner, who holds the business details and pays for the certificate, and for engineering, who wires signing into the Windows agent's build. The chosen option is an OV (Organization Validation) certificate with cloud signing, from a provider such as Certum SimplySign, SSL.com eSigner or DigiCert KeyLocker, at roughly 200–500 US dollars a year. Validation takes a few days to two weeks, so the purchase starts 3–4 weeks before the Windows beta. Certificates issued from 2026-03-01 are valid for at most 460 days, so the certificate is renewed every year. As of 2026-10-23 the certificate had not been bought.

## Purpose of the code-signing procedure

The code-signing procedure makes sure eGuard for Windows is signed with the registered business name as its publisher. Without a signature, Windows SmartScreen warns on every install, and Microsoft Defender may flag a service that ends other processes. Keeping the same certificate and publisher name across releases lets SmartScreen reputation build up.

## When the code-signing procedure applies, and when it does not

The code-signing procedure applies to:

- buying the first code-signing certificate before the eGuard for Windows beta;
- renewing the certificate every year;
- handling a Microsoft Defender false positive after a release.

The code-signing procedure does not apply to:

- signing the Android or iPhone and iPad apps, which use their own app store processes;
- the eGuard browser extension's signing keys (see "Systems Overview").

## Options considered for code signing

| Option | Decision and reason |
|---|---|
| Azure Artifact Signing (formerly Trusted Signing), about 10 US dollars a month | Not available to DevCom: it is open to organizations in the US, Canada, the EU and the UK, and to individuals in the US and Canada only. |
| EV certificate | Not worth the extra cost. Since 2024 it no longer skips SmartScreen; EV and OV files build reputation the same way. EV is needed only for kernel drivers, and the agent has none. |
| OV certificate on a USB token | Works, but the token has to be shipped to the Philippines and cannot sign in an automated build. |
| **OV certificate with cloud signing** | **Chosen.** The key stays on the certificate authority's secure server and signing happens over its API, so it works from a build server and nothing is shipped. |

Providers with cloud signing: Certum SimplySign (usually the cheapest), SSL.com eSigner, DigiCert KeyLocker (costs more). Prices are checked on their sites before buying; some add a cloud-signing fee on top of the yearly price.

Who decided the OV option, and when, is [TO CONFIRM: date and decision-maker for the OV choice].

## Roles involved in code signing

| Role | Responsibility |
|---|---|
| Owner | Checks the Dun & Bradstreet record, chooses the provider, pays, supplies the business documents, answers the provider's validation call, renews every year. [TO CONFIRM: whether the owner or another role does each of these] |
| Engineer | Wires cloud signing into the agent's build, adds timestamps, stores the signing secrets, documents the setup, submits false positives to Microsoft. |
| Person who answers the listed business phone | Takes the certificate authority's validation call. [TO CONFIRM: who answers the listed phone] |

## Inputs needed before buying the certificate

1. The company's D-U-N-S number. It is ready (status 2026-10-23); the number itself is kept with the business records, not in this document. [TO CONFIRM: where the D-U-N-S number is kept]
2. The registered business name, exactly as on the DTI or SEC registration. [TO CONFIRM: registered business name]
3. The registration type and number: DTI (sole proprietorship) or SEC (corporation). [TO CONFIRM: DTI or SEC registration]
4. The registration documents.
5. A business phone number that is listed in the Dun & Bradstreet record and is answered.
6. Budget approval for the yearly cost given in the Summary, plus any cloud-signing fee.
7. The date of the Windows beta, because the purchase starts ahead of it (lead time in "Time targets for code signing"). [TO CONFIRM: Windows beta date]

An individual certificate must not be used: it would show a personal name to parents as the publisher.

## Code-signing procedure, steps 1 to 4: buying and validating

1. **Owner (Dun & Bradstreet website):** check the D&B record. The business name, address and phone must match the DTI or SEC papers exactly; a difference such as "Inc." against "Inc" is enough to stall validation. If anything is off, then ask D&B to correct it first and wait (duration in "Time targets for code signing").
2. **Owner (provider's website):** buy an OV certificate with cloud signing from one of the providers in "Options considered for code signing". Choose an RSA key of 3072 bits or more. Give the provider the registered business name, the D-U-N-S number, the registration documents and the listed phone number.
3. **Owner:** pass validation. The provider reviews the documents and calls the listed number (duration in "Time targets for code signing"). If validation stalls on a mismatch, then go back to step 1.
4. **Owner to engineer:** hand over the setup for the build: which provider, and the publisher name exactly as it appears on the certificate. The password, one-time codes and API secrets are never put in chat, a commit or a document; they go only into the build system's secret store or environment variables.

## Code-signing procedure, steps 5 to 7: signing the build

5. **Engineer (agent build):** wire signing into the build of eGuard for Windows:
   - sign every `.exe` and `.dll` and the MSI installer with `signtool`, through the provider's cloud signing tool;
   - always add an RFC 3161 timestamp, so signatures stay valid after the certificate expires;
   - use the custom sign command that the Tauri and WiX build tools accept.
6. **Engineer:** document the signing setup in the Windows agent's specification (desktop-agent-spec.md), without any secret values.
7. **Engineer:** start the release with a small beta group, keeping the same certificate and publisher name across releases.

## Code-signing procedure, steps 8 and 9: after release and renewal

8. **Engineer (Microsoft's malware submission portal):** if Microsoft Defender flags the agent, then submit the files as a false positive.
9. **Owner (provider's website), every year:** renew before the certificate expires, and expect to pass validation again (go back to step 1 to re-check the D&B record). Keep the same publisher name so that SmartScreen reputation carries over. [TO CONFIRM: how far ahead of expiry renewal starts]

## Approvals required for code signing

| What | Who approves | Limit |
|---|---|---|
| Buying or renewing the certificate | [TO CONFIRM: approver role] | [TO CONFIRM: spending limit; sources estimate about 200–500 US dollars a year] |
| Choice of provider | [TO CONFIRM: approver role] | Not applicable |
| Changing the publisher name | [TO CONFIRM: approver role] | Not applicable |

## Exceptions to the code-signing procedure

| Situation | What to do |
|---|---|
| D&B record does not match the registration | Correct the D&B record before buying (step 1). |
| Validation takes longer than two weeks | [TO CONFIRM: escalation, and whether the Windows beta waits] |
| A signing secret is exposed in chat, a commit or a document | [TO CONFIRM: how to revoke and replace cloud-signing credentials with the provider] |
| The certificate expires before renewal | Files already signed with an RFC 3161 timestamp stay valid; new builds cannot be signed until renewal. |
| Defender flags the agent | Submit a false positive (step 8). |

## Outputs of code signing and where they are recorded

| Output | Where it is recorded |
|---|---|
| Certificate order and invoice | Provider account [TO CONFIRM: where purchase records are kept] |
| Publisher name and provider | Handed to engineering (step 4); documented in desktop-agent-spec.md |
| Signing password, one-time codes, API secrets | Build system's secret store or environment variables only |
| Signed installer and files | The Windows agent's build output |
| Expiry date | [TO CONFIRM: where the renewal date is tracked] |

## Time targets for code signing

| Item | Target |
|---|---|
| D&B correction, if needed | A few days to a couple of weeks |
| Validation | A few days to two weeks |
| Start of purchase | 3–4 weeks before the Windows beta |
| Certificate validity | At most 460 days (about 15 months); renew every year |

## Document control

| Owner (role) | Version | Effective date | Review date | Related documents |
|---|---|---|---|---|
| [TO CONFIRM: owner role] | 0.1 (draft) | [TO CONFIRM] | [TO CONFIRM] | eguard: Decision Log; eguard: Risks, Assumptions and Constraints; Engineering Standards and Release Procedure; Systems Overview; Data Handling and Confidentiality |

## Open questions

1. [TO CONFIRM: date and decision-maker for the OV choice].
2. [TO CONFIRM: whether the owner or another role does each of these] (D&B check, purchase, documents, validation, renewal).
3. [TO CONFIRM: who answers the listed phone].
4. [TO CONFIRM: where the D-U-N-S number is kept]. code-signing.md holds the number in its "Business details" table; it is left out of this document on purpose.
5. [TO CONFIRM: registered business name]. code-signing.md leaves it as "fill in: exactly as on the DTI or SEC registration".
6. [TO CONFIRM: DTI or SEC registration]. code-signing.md leaves it as "fill in".
7. [TO CONFIRM: Windows beta date].
8. [TO CONFIRM: how far ahead of expiry renewal starts].
9. [TO CONFIRM: approver role] and [TO CONFIRM: spending limit; sources estimate about 200–500 US dollars a year] for buying or renewing; approver for the provider choice and for changing the publisher name.
10. [TO CONFIRM: escalation, and whether the Windows beta waits] when validation runs long.
11. [TO CONFIRM: how to revoke and replace cloud-signing credentials with the provider].
12. [TO CONFIRM: where purchase records are kept] and [TO CONFIRM: where the renewal date is tracked].
13. [TO CONFIRM: owner role], effective date and review date for this SOP.
14. Cost and option disagree. pricing-desktop.md §2: "About $10 a month (Azure Trusted Signing), or $200–400 a year (OV certificate)". code-signing.md: Azure Artifact Signing is open only to organizations in the US, Canada, the EU and the UK, "so not available to us", and an OV certificate costs "roughly $200–500 a year, sometimes plus a cloud-signing fee". This SOP follows code-signing.md; pricing-desktop.md's cost table looks out of date.
15. code-signing.md's status is dated 2026-10-23 ("not bought yet"). Confirm whether the certificate has been bought since, and with which provider.
16. code-signing.md step 5 names the build tools as Tauri and WiX, while the source inventory notes that desktop-agent-spec.md overruled a Tauri UI (it uses plain Win32 windows). Confirm which build and installer tools take the sign command.
