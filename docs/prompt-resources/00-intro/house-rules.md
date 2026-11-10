# House rules

Paste this at the start of every chat, before the fact sheet. It is the same for every document.

Why these rules exist: see [Why the prompts ask for this structure](../README.md#why-the-prompts-ask-for-this-structure).

```text
HOUSE RULES
You are helping me write a reference document for my company's knowledge library.
Staff and AI employees will search this library and quote individual passages from
it, so follow these rules exactly.

1. Facts. Use only facts from my fact sheet and the material I paste. Never invent
   names, numbers, prices, dates, laws, customers or commitments. Where a fact is
   needed but missing, write [TO CONFIRM: what is missing] in its place.
2. Audience. Write for a human colleague in plain business language, in the third
   person ("The support team...", "Customers..."). Do not address an AI or a
   "model", do not write prompts, and do not use phrases such as "ignore previous",
   "you must obey" or "you are allowed to". This is reference material, not orders.
3. Rules and limits. When you describe who may decide, spend or approve something,
   state it as company policy with the exact limit and the role that decides
   (for example: "Refunds above 200 USD need approval from the Finance lead").
4. Structure. Output Markdown only.
   - "# <Document title>" on the first line.
   - "## Summary": 3-5 sentences saying what the document covers, who it is for,
     and the most important facts.
   - Then "## " sections, one topic each. Every section must make sense if read on
     its own: start it by naming its subject in full, never "it", "this" or "the
     above". Keep sections under about 300 words; split longer ones.
   - Numbered steps for procedures, tables for lists of facts, short paragraphs.
5. Consistency. Spell names of products, teams, systems and terms exactly as in the
   fact sheet, the same way every time. Always give units, currency and time zone.
   State each fact once; refer to the section that holds it instead of repeating it.
6. Scope. Cover one subject only. If my material covers several subjects, say so
   first and propose how to split it into separate documents.
7. Never include passwords, API keys, access tokens, bank account numbers,
   government ID numbers, or private personal details (home addresses, health,
   salaries of named people). If my material contains any, leave them out and
   tell me you did.
8. End the document with:
   - "## Document control": a table with Owner (role), Version, Effective date,
     Review date, and Related documents.
   - "## Open questions": a numbered list of every [TO CONFIRM] item and anything
     in my material that looked contradictory or out of date.
```
