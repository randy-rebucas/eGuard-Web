# eguard knowledge resources

Draft knowledge documents for the eguard project, made from the files in `docs/` with the prompts in [prompt-resources](../prompt-resources/README.md). The folders mirror prompt-resources, one folder per section.

> **Status: drafts handed over (step 6), 2026-11-10.** 26 documents drafted at version 0.1, drafted at the owner's request before the plan questions were answered. Every draft still carries [TO CONFIRM] markers and an Open questions section, so none is ready to upload. Start with the [review report](_review/review-report.md): 189 merged open questions, the contradictions, and the upload order.

## Contents

| Folder | What it holds |
|---|---|
| [00-intro](00-intro/Intro%20-%20Index.md) | [Project fact sheet](00-intro/project-fact-sheet.md) and [drafting conventions](00-intro/drafting-conventions.md), filled from the sources. The house rules stay in [prompt-resources](../prompt-resources/00-intro/house-rules.md) |
| [01-company-foundations](01-company-foundations/Company%20Foundations%20-%20Index.md) | C1–C6: company-wide documents for DevCom Digital Marketing Services |
| [02-project-documents](02-project-documents/Project%20Documents%20-%20Index.md) | P1–P5: documents for the eguard project (objective) |
| [03-department-documents](03-department-documents/Department%20Documents%20-%20Index.md) | D1–D10 and the S1 procedures |
| [04-training-material](04-training-material/Training%20Material%20-%20Index.md) | T1 lesson pack |
| [05-document-tools](05-document-tools/Document%20Tools%20-%20Index.md) | Not uploaded: results of the M prompts run as checks (M7 per draft, M5 across drafts, M3 split proposals) |
| [_review](_review/Review%20-%20Index.md) | Not uploaded: the [source inventory](_review/source-inventory.md) and the [review report](_review/review-report.md) |

## Catalogue

**Decision:** Draft = the sources have enough material. Thin = some material, many gaps ([TO CONFIRM] markers). Skip = no material. Category, Confidentiality and Available to are copied from each prompt file.

| # | Document | Decision | Status | Main sources | Category | Confidentiality | Available to |
|---|---|---|---|---|---|---|---|
| **Intro** | | | | | | | |
| – | [Project fact sheet](00-intro/project-fact-sheet.md) | – | Done (waiting for answers) | All sources | (not uploaded) | | |
| **Company foundations** | | | | | | | |
| C1 | [Company Overview](01-company-foundations/Company%20Overview.md) | Thin | Drafted (v0.1) | profile.md, press-release.md, faq.md, launch-visibility.md | Reference | Internal | Company-wide |
| C2 | [Company Glossary](01-company-foundations/Company%20Glossary.md) | Draft | Drafted (v0.1) | profile.md, faq.md, subscriptions.md, organizations.md, mobile-api.md, console.md, features/*.md | Reference | Internal | Company-wide |
| C3 | [Products and Services Catalogue](01-company-foundations/Products%20and%20Services%20Catalogue.md) | Draft | Drafted (v0.1) | subscriptions.md, profile.md, plan-change-2026-10.md, pricing-desktop.md, organizations.md, faq.md, knowledge-center.md | Sales & marketing | Internal (Public if it only holds published information) | Company-wide |
| C4 | Teams and responsibilities | Skip | Skipped | No team or department material (only "owner", "staff", "DPO") | Reference | Internal | Company-wide |
| C5 | Communication and conduct standards | Skip | Skipped | No internal conduct material; external-claims rules go in D4 | Policy (controlled) | Internal | Company-wide |
| C6 | [Data Handling and Confidentiality](01-company-foundations/Data%20Handling%20and%20Confidentiality.md) | Thin | Drafted (v0.1) | console.md, profile.md, app-listing.md, features/location.md, features/parent-care.md, organizations.md, subscriptions.md, launch-visibility.md | Policy (controlled) | Internal | Company-wide |
| **Project documents** | | | | | | | |
| P1 | [eguard: Project Brief](02-project-documents/eguard%20-%20Project%20Brief.md) | Thin | Drafted (v0.1) | launch-visibility.md, profile.md, press-release.md (depends on question 1) | Project | Internal | Project (objective) |
| P2 | [eguard: Requirements and Acceptance Criteria](02-project-documents/eguard%20-%20Requirements%20and%20Acceptance%20Criteria.md) | Thin | Drafted (v0.1) | child-app-spec.md, desktop-agent-spec.md, launch-visibility.md, features/parent-care.md, organizations.md | Project | Internal | Project (objective) |
| P3 | Stakeholders and communication plan | Skip | Skipped | No stakeholder or meeting material | Project | Internal | Project (objective) |
| P4 | [eguard: Decision Log](02-project-documents/eguard%20-%20Decision%20Log.md) | Draft | Drafted (v0.1) | pricing-desktop.md, plan-change-2026-10.md, subscriptions.md, desktop-agent-spec.md, desktop-agent-open-questions.md, child-app-spec.md, mobile-organizations.md, code-signing.md, app-listing.md | Project | Internal | Project (objective) |
| P5 | [eguard: Risks, Assumptions and Constraints](02-project-documents/eguard%20-%20Risks,%20Assumptions%20and%20Constraints.md) | Draft | Drafted (v0.1) | app-listing.md, pricing-desktop.md, desktop-agent-open-questions.md, code-signing.md, launch-visibility.md, features/parent-care.md | Project | Internal | Project (objective) |
| **Department documents** | | | | | | | |
| D1 | [Customer Support Playbook](03-department-documents/Customer%20Support%20Playbook.md) | Thin | Drafted (v0.1) | subscriptions.md (troubleshooting, refunds), console.md, faq.md, mobile-api.md, organization-api.md (recipes) | SOP (controlled) | Internal | Department: support |
| D2 | [Customer FAQ](03-department-documents/Customer%20FAQ.md) | Draft | Drafted (v0.1) | faq.md, profile.md, facebook-page.md, subscriptions.md | Customer support | Public or Internal | Department: support (add sales if useful) |
| D3 | [Sales Playbook](03-department-documents/Sales%20Playbook.md) | Thin | Drafted (v0.1) | profile.md, organizations.md, pricing-desktop.md (competitors), press-release.md, launch-visibility.md | Sales & marketing | Internal | Department: sales |
| D4 | [Brand Voice and Writing Style Guide](03-department-documents/Brand%20Voice%20and%20Writing%20Style%20Guide.md) | Thin | Drafted (v0.1) | press-release.md, launch-visibility.md, knowledge-center.md, facebook-page.md, marketing-site-review.md, app-listing.md | Sales & marketing | Internal | Company-wide |
| D5 | [Pricing and Discount Rules](03-department-documents/Pricing%20and%20Discount%20Rules.md) | Draft | Drafted (v0.1) | subscriptions.md, plan-change-2026-10.md, pricing-desktop.md, organizations.md, profile.md | Financial | Confidential | Department: sales and finance (needs the **Retrieve confidential knowledge** authority) |
| D6 | [Systems Overview](03-department-documents/Systems%20Overview.md) | Draft | Drafted (v0.1) | features/*.md, subscriptions.md, mobile-api.md, browser-extension-api.md, organization-api.md, console.md, desktop-agent-spec.md, launch-visibility.md | Technical | Internal | Department: engineering |
| D7 | [Engineering Standards and Release Procedure](03-department-documents/Engineering%20Standards%20and%20Release%20Procedure.md) | Thin | Drafted (v0.1) | plan-change-2026-10.md, features/parent-care.md, features/authentication.md, code-signing.md, launch-visibility.md, knowledge-center.md | SOP (controlled) | Internal | Department: engineering |
| D8 | Invoicing and expenses procedure | Skip | Skipped | Only "PayMongo emails receipts" and an open BIR receipts question | SOP (controlled) | Internal | Department: finance |
| D9 | Standard terms summary | Skip | Skipped | The Terms page is in the code, not in the sources | Legal | Confidential | Role: the roles that handle contracts |
| D10 | People policies summary | Skip | Skipped | No HR material | HR | Internal | Company-wide |
| S1-a | [Refunding a Purchase](03-department-documents/Refunding%20a%20Purchase.md) | Draft | Drafted (v0.1) | subscriptions.md §13, organizations.md | SOP (controlled) | Internal | Support / finance |
| S1-b | [Sending a Broadcast to Parents](03-department-documents/Sending%20a%20Broadcast%20to%20Parents.md) | Draft | Drafted (v0.1) | console.md, plan-change-2026-10.md §2 | SOP (controlled) | Internal | Support / marketing staff |
| S1-c | [Releasing a Plan-Limit or Price Change](03-department-documents/Releasing%20a%20Plan-Limit%20or%20Price%20Change.md) | Draft | Drafted (v0.1) | plan-change-2026-10.md, subscriptions.md (changing a price), pricing-desktop.md §6–7 | SOP (controlled) | Internal | Department: engineering |
| S1-d | [Buying and Renewing the Code-Signing Certificate](03-department-documents/Buying%20and%20Renewing%20the%20Code-Signing%20Certificate.md) | Draft | Drafted (v0.1) | code-signing.md | SOP (controlled) | Internal | Owner / engineering |
| S1-e | [Writing and Checking a Knowledge Center Article](03-department-documents/Writing%20and%20Checking%20a%20Knowledge%20Center%20Article.md) | Draft | Drafted (v0.1) | knowledge-center.md | SOP (controlled) | Internal | Content / marketing |
| S1-f | [Deploying, Pausing and Rolling Back Parent Care](03-department-documents/Deploying,%20Pausing%20and%20Rolling%20Back%20Parent%20Care.md) | Draft | Drafted (v0.1) | features/parent-care.md | SOP (controlled) | Internal | Department: engineering |
| S1-g | [Submitting the App to Google Play and the App Store](03-department-documents/Submitting%20the%20App%20to%20Google%20Play%20and%20the%20App%20Store.md) | Thin | Drafted (v0.1) | app-listing.md | SOP (controlled) | Internal | Engineering / owner |
| S1-h | [Refreshing the Store-Review Demo Account](03-department-documents/Refreshing%20the%20Store-Review%20Demo%20Account.md) | Draft | Drafted (v0.1) | app-listing.md §12 | SOP (controlled) | Internal | Department: engineering |
| S1-i | [Production Go-Live Checks](03-department-documents/Production%20Go-Live%20Checks.md) | Thin | Drafted (v0.1) | launch-visibility.md (production go-live, checklist) | SOP (controlled) | Internal | Department: engineering |
| S1-j | [Setting Up PayMongo](03-department-documents/Setting%20Up%20PayMongo.md) | Draft | Drafted (v0.1) | subscriptions.md §10 | SOP (controlled) | Internal | Department: engineering |
| **Training material** | | | | | | | |
| T1 | [Customer Support Agent: Lesson Pack](04-training-material/Customer%20Support%20Agent%20-%20Lesson%20Pack.md) | Thin | Drafted (v0.1) | faq.md, subscriptions.md, console.md, mobile-api.md | Training | Internal | Role (or attach it to a training program) |
| T2 | Practice questions | Skip (by instruction) | Skipped | Written later from published documents | (not uploaded) | | |

Not proposed as S1: the Facebook Page setup (facebook-page.md) is a one-time checklist and fits D4 or a marketing note; the organization API recipes (organization-api.md) are customer instructions and fit D1.

## File names

Drafts are saved in the folder matching prompt-resources and named after the document title, as UTF-8 Markdown. For example, P1 becomes `02-project-documents/eguard - Project Brief.md`. Each section folder's index (`<Section name> - Index.md`) links its drafts and tracks their status.

## Questions for the owner

The full merged list is in the [review report](_review/review-report.md#open-questions). The questions that block the most documents:

1. **Owner role, effective date and review date** for each document: all 26 drafts.
2. **Which plan limits are current** ([inventory](_review/source-inventory.md), contradiction 1). The drafts use Free 1 child / 1 device, eGuard Plus 3 / 5 and eGuard Family 6 / 12 provisionally: 15 drafts.
3. **Whether push alerts work** (contradiction 5): 15 drafts.

Next: whether eGuard for Android is live on Google Play (14 drafts), whether a browser on a paired Windows PC takes a device slot (11), and which objective "the project" is (the four project documents). Add the answers to the [fact sheet](00-intro/project-fact-sheet.md) and the [drafting conventions](00-intro/drafting-conventions.md), then update the drafts with prompt M4.
