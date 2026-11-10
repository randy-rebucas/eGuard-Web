# Prompt resources

Ready-made prompts for drafting knowledge documents with an AI chat assistant, one file per prompt. Paste them into any chat assistant your company allows for this information. Each turns what you know about your company and a project into a document ready to upload to the **Knowledge Library**.

> Source: these files are taken from the user guide chapter [Knowledge prompts](../user-guide/11-knowledge-prompts.md), which is also what the console's **Prompt guide** shows. When a prompt changes, change it there first, then here.

The prompts do not make anything up. Each one works from a **fact sheet** you fill in once per project and from any material you paste in. Where a fact is missing, the draft says so with a `[TO CONFIRM: ...]` marker instead of guessing.

> A drafted document is only a draft. You still check every fact, remove every marker and approve the document in the console. Agents treat whatever you publish as your company's truth.

## Contents

| Folder | What it holds |
|---|---|
| [00-intro](00-intro/) | [Project fact sheet](00-intro/project-fact-sheet.md), [House rules](00-intro/house-rules.md): paste both into every chat |
| [01-company-foundations](01-company-foundations/) | C1–C6: written once for the company, reused by every project |
| [02-project-documents](02-project-documents/) | P1–P5: one set per project (objective) |
| [03-department-documents](03-department-documents/) | D1–D10 and S1: playbooks, procedures and policies for a department |
| [04-training-material](04-training-material/) | T1–T2: lesson packs and assessment questions |
| [05-document-tools](05-document-tools/) | M1–M7: interviewing, converting, splitting, updating and checking documents |

## How to use them

1. **Fill in the [project fact sheet](00-intro/project-fact-sheet.md)** once. If you would rather be asked questions, use [M1 Interview me](05-document-tools/M1-interview-me-to-build-the-fact-sheet.md).
2. **Start a new chat** for each document. Paste, in this order: the [house rules](00-intro/house-rules.md), your fact sheet, then the prompt for the document you want. Paste any existing material (notes, emails, old documents) after the prompt.
3. **Answer the open questions.** Each draft ends with a list of what it could not fill in. Reply in the same chat with the answers and ask for the corrected document.
4. **Clean up and save.** Check every fact. Delete the **Open questions** section and make sure no `[TO CONFIRM` marker is left. Save the result as UTF-8 Markdown (`.md`), named after the document, for example `Customer Support Playbook.md`.
5. **Upload** it on **Knowledge Library** with the category, confidentiality and **Available to** scope suggested in the prompt file.
6. **Review and approve.** Read the **Extracted text** and **Passages**, then approve on **Approvals**. Policies and SOPs need the owner.
7. **Check access.** In **Search and access check**, ask a question the document answers, as one of the AI employees it is for, and as one it is not for.

## Catalogue

The settings are suggestions. Change them to fit who should read the document.

| # | Document | Category | Confidentiality | Available to |
|---|---|---|---|---|
| **Intro** | | | | |
| – | [Project fact sheet](00-intro/project-fact-sheet.md) | (not uploaded) | | Pasted into every chat |
| – | [House rules](00-intro/house-rules.md) | (not uploaded) | | Pasted into every chat |
| **Company foundations** | | | | |
| C1 | [Company overview](01-company-foundations/C1-company-overview.md) | Reference | Internal | Company-wide |
| C2 | [Glossary](01-company-foundations/C2-glossary.md) | Reference | Internal | Company-wide |
| C3 | [Products and services catalogue](01-company-foundations/C3-products-and-services-catalogue.md) | Sales & marketing | Internal (Public if it only holds published information) | Company-wide |
| C4 | [Teams and responsibilities](01-company-foundations/C4-teams-and-responsibilities.md) | Reference | Internal | Company-wide |
| C5 | [Communication and conduct standards](01-company-foundations/C5-communication-and-conduct-standards.md) | Policy (controlled) | Internal | Company-wide |
| C6 | [Data handling and confidentiality policy](01-company-foundations/C6-data-handling-and-confidentiality-policy.md) | Policy (controlled) | Internal | Company-wide |
| **Project documents** | | | | |
| P1 | [Project brief](02-project-documents/P1-project-brief.md) | Project | Internal | Project (objective) |
| P2 | [Requirements and acceptance criteria](02-project-documents/P2-requirements-and-acceptance-criteria.md) | Project | Internal | Project (objective) |
| P3 | [Stakeholders and communication plan](02-project-documents/P3-stakeholders-and-communication-plan.md) | Project | Internal | Project (objective) |
| P4 | [Decision log](02-project-documents/P4-decision-log.md) | Project | Internal | Project (objective) |
| P5 | [Risks, assumptions and constraints](02-project-documents/P5-risks-assumptions-and-constraints.md) | Project | Internal | Project (objective) |
| **Department documents** | | | | |
| D1 | [Customer support playbook](03-department-documents/D1-customer-support-playbook.md) | SOP (controlled) | Internal | Department: support |
| D2 | [Customer FAQ](03-department-documents/D2-customer-faq.md) | Customer support | Public or Internal | Department: support (add sales if useful) |
| D3 | [Sales playbook](03-department-documents/D3-sales-playbook.md) | Sales & marketing | Internal | Department: sales |
| D4 | [Brand voice and writing style guide](03-department-documents/D4-brand-voice-and-writing-style-guide.md) | Sales & marketing | Internal | Company-wide |
| D5 | [Pricing and discount rules](03-department-documents/D5-pricing-and-discount-rules.md) | Financial | Confidential | Department: sales and finance (needs the **Retrieve confidential knowledge** authority) |
| D6 | [Systems overview](03-department-documents/D6-systems-overview.md) | Technical | Internal | Department: engineering |
| D7 | [Engineering standards and release procedure](03-department-documents/D7-engineering-standards-and-release-procedure.md) | SOP (controlled) | Internal | Department: engineering |
| D8 | [Invoicing and expenses procedure](03-department-documents/D8-invoicing-and-expenses-procedure.md) | SOP (controlled) | Internal | Department: finance |
| D9 | [Standard terms summary](03-department-documents/D9-standard-terms-summary.md) | Legal | Confidential | Role: the roles that handle contracts |
| D10 | [People policies summary](03-department-documents/D10-people-policies-summary.md) | HR | Internal | Company-wide |
| S1 | [Any procedure (generic SOP)](03-department-documents/S1-any-procedure.md) | SOP (controlled) | Internal | The department or role that runs it |
| **Training material** | | | | |
| T1 | [Role lesson pack](04-training-material/T1-role-lesson-pack.md) | Training | Internal | Role (or attach it to a training program) |
| T2 | [Practice questions](04-training-material/T2-practice-questions.md) | (not uploaded) | | Typed into an assessment in the Training Academy |
| **Document tools** | | | | |
| M1 | [Interview me to build the fact sheet](05-document-tools/M1-interview-me-to-build-the-fact-sheet.md) | (not uploaded) | | |
| M2 | [Turn raw material into a document](05-document-tools/M2-turn-raw-material-into-a-document.md) | (not uploaded) | | |
| M3 | [Split a long document](05-document-tools/M3-split-a-long-document.md) | (not uploaded) | | |
| M4 | [Prepare a new version](05-document-tools/M4-prepare-a-new-version.md) | (not uploaded) | | Upload the result with **Upload new version** |
| M5 | [Contradiction check before upload](05-document-tools/M5-contradiction-check-before-upload.md) | (not uploaded) | | |
| M6 | [Find what knowledge is missing](05-document-tools/M6-find-what-knowledge-is-missing.md) | (not uploaded) | | |
| M7 | [Final check before upload](05-document-tools/M7-final-check-before-upload.md) | (not uploaded) | | |

## Why the prompts ask for this structure

The house rules shape every draft around how the library actually works:

- **Agents read passages, not whole documents.** A lookup uses at most three passages per document. So each section has to make sense on its own, name its subject instead of saying "it" or "this", and keep one topic per document.
- **Planning sees only public and internal documents.** A project brief that the plan needs must be **Internal**, not **Confidential**.
- **Documents are data, never orders.** The platform screens uploads for hidden instructions, and agents treat document text as untrusted reference material. So the drafts are written for a human reader and never address "the AI".
- **A document cannot give an AI employee permission to do anything.** What an employee may decide, spend or approve is set on its page under authority and on **Approvals**. A document can describe your company's rule (for example "refunds over $200 need the Finance lead's approval"), and agents will cite it. To make the platform enforce that rule, set it on the employee's authority and approval rules as well.
- **Contradictions block agents.** When two published documents disagree, the platform suggests a conflict, and agents must not rely on either document until a person resolves it. One fact in one place, with the same wording every time, avoids that.
- **No secrets.** Passwords, API keys and tokens never belong in a document. Connections hold credentials.

## Rules worth remembering

- **The prompts draft, you decide.** Nothing reaches an agent until a person approves it, and policies and SOPs need the owner.
- **Never upload a draft with markers in it.** Agents read `[TO CONFIRM]` and **Open questions** like any other text.
- **One fact, one place.** Put each price, limit or rule in exactly one document and refer to it from others.
- **Update, don't duplicate.** A changed document is a new version of the same document.
- **Documents describe your rules; the platform enforces them.** Set limits and approvals on the AI employee's authority and on **Approvals** to enforce them.
- **Sensitive content gets its own document** so you can mark it **Confidential** or **Restricted** without hiding the rest from planning.
- **Set a review date** on anything that goes out of date (prices, project plans, decision logs) so the library shows "Review due".

For troubleshooting (made-up facts, screening flags, documents agents cannot find), see [Knowledge prompts: Troubleshooting](../user-guide/11-knowledge-prompts.md#troubleshooting).
