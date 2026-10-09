# AppView hydration

- Endpoint-specific viewer block checks must honor `HydrateCtx.skipViewerBlocks` for the trusted moderation service, while preserving viewer block metadata and mute filtering.
- `ExternalHydrator` generic record lookups decode record bodies without collection-specific validation. Validate against the relevant Lexicon before using typed fields; do not apply parse-mode defaults to stored records.
- `Views.externalRecordView` consumes `HydrationState.externalRecords` (latest versions), `externalRecordBacklinks` (target URI → available source URI samples), and `externalRecordBacklinkCounts`. Hydrate referenced publications, gallery item/photo records, backlink source records, labels, and profiles before building views. Counts are independent of the sampled previews.
- Modality builders do not resolve web URLs. Grain galleries use their record AT URI; Streamplace uses a declared HTTP(S) URL or falls back to its AT URI. A stream is active only without `endedAt` and with a `lastSeenAt` within `LIVESTREAM_HEARTBEAT_WINDOW_MS` (2 minutes) of `now`, on either side; record `idleTimeoutSeconds` and `createdAt` are ignored.
- Keep Atmosphere Explore-specific hydration and helpers in `getAtmosphereExploreTab.ts`; reuse `ExternalHydrator` for generic reads.
- Exact-ref hydration maps use `genericRecordKey(uri, cid)`, not URI alone. Unavailable records are `null`, and takedowns are excluded unless explicitly requested.
- Preserve `truncated` from actor backlink lookups: an empty target entry in a truncated batch does not prove the actor has no links.
- `ExternalHydrator.getSiteStandardRecordsByURI` / `ByRef` are built on the generic record lookups. Only `ByURI` follows a document's `site` to its publication, via a second lookup; `ByRef` never resolves publications.
