---
'@atproto/lexicon': patch
---

Remove the non-spec `description` field from the `lexPermissionSet` Zod schema.
The Lexicon `permission-set` definition only allows `title`, `title:lang`,
`detail`, `detail:lang`, and `permissions`, and the newer `@atproto/lex-schema`
`PermissionSetOptions` model does not include `description` either. No lexicon
JSON in this repository sets a top-level `description` on a permission set, so
this aligns the legacy schema with the specification and the modern SDK without
affecting any valid document.
