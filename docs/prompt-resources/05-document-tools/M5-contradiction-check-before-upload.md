# M5 Contradiction check before upload

**How to use:** paste the prompt below into a new chat and fill in the `<paste>` placeholders.

## Prompt

```text
Below are a new draft and the existing documents it is most likely to overlap
with. Find every statement in the draft that contradicts, or could be read as
contradicting, a statement in an existing document: different numbers, limits,
dates, owners, steps or definitions. For each, quote the exact sentence from
both documents, name the documents, and say which kind of difference it is.
Do not resolve them and do not rewrite anything. If there are none, say so.

New draft:
<paste>

Existing documents:
<paste each one with its title>
```

## After drafting

The platform runs its own contradiction scan after publishing; this check catches the obvious ones before they reach your agents.
