---
'@atproto/lex-builder': patch
---

Fix generated import specifiers for refs to a parent namespace. A lexicon like `com.example.foo.child` referencing `com.example.foo` previously produced `./.defs.js` (or `./...defs` for deeper nesting) because the `.defs` suffix was appended after computing the relative path; the suffix now participates in the path resolution, yielding `../foo.defs.js`.
