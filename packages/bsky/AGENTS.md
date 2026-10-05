# AppView hydration

- `ExternalHydrator` generic record lookups decode record bodies without collection-specific validation. Validate against the relevant Lexicon before using typed fields; do not apply parse-mode defaults to stored records.
- Exact-ref hydration maps use `genericRecordKey(uri, cid)`, not URI alone. Unavailable records are `null`, and takedowns are excluded unless explicitly requested.
- Preserve `truncated` from actor backlink lookups: an empty target entry in a truncated batch does not prove the actor has no links.
