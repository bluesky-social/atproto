# Mod inbox endpoint implementation plan

Updated: 2026-09-25. This file is the handoff record for work across agent sessions.

## Goal and stack

- Base: [atproto PR #5459](https://github.com/bluesky-social/atproto/pull/5459), branch `ozone/mod-inbox/appeal`.
- PR 1: `tools.ozone.inbox.getAccountStatus`, `listReports`, `getReport`, `listActionedSubjects`, `getActionedSubject`, with tests. Target base: `ozone/mod-inbox/appeal`.
- PR 2: `tools.ozone.inbox.listNotifications`, `getNotificationPreferences`, `putNotificationPreferences`, `getUnreadCount`, `updateSeen`, with tests. Target base: PR 1's branch.
- Source contract: [Linear mod inbox tech spec](https://linear.app/blueskyweb/document/mod-inbox-tech-spec-0c36ca149153). The direct URL currently serves only the Linear JavaScript shell to this environment. Verify the document body before treating inferred API shapes as final.

## Current state

- [x] Confirmed clean checkout at PR #5459's head branch.
- [x] Read repository guidance, testing guidance, and existing inbox appeal/view code.
- [x] Confirmed the base PR provides `appealActionedSubject`, inbox `defs`, subject hydration, and appeal tests.
- [x] Created branch `ozone/mod-inbox/read` from the base PR branch and committed the plan.
- [x] Inspected the existing `report` and `moderation_event` indexes. No new large-table index has been proposed.
- [ ] Obtain the Linear spec body or equivalent authoritative endpoint schemas. A reachable document URL alone is insufficient.
- [ ] Record exact request/response shapes, authorization rules, pagination, privacy rules, and notification semantics below.

## PR 1 checklist

- [ ] Add lexicons for five read methods and any shared definitions; run root `pnpm codegen`.
- [ ] Implement authenticated Ozone routes under `packages/ozone/src/api/inbox`, register them in `src/api/index.ts`.
- [ ] Reuse existing subject/appeal view builders. Scope every read to the authenticated DID; avoid exposing moderator notes, reporter identities, or private event metadata.
- [ ] Use stable keyset pagination and deterministic tie breaking for lists. Recheck cursor filtering and visibility at page boundaries.
- [ ] Inspect existing `report` and `moderation_event` indexes and query plans. Add an index on the large `moderation_event` table only if a real hot path cannot use an existing one, and document the plan evidence.
- [ ] Add meaningful route/integration tests for account isolation, pagination, missing resources, event/report visibility, and response shape.
- [ ] Build, typecheck, run focused tests, format/lint changed files, add a changeset for each touched package.
- [ ] Commit, push, create PR based on `ozone/mod-inbox/appeal`, and record URL here.

## PR 2 checklist

- [ ] Add notification lexicons and storage/schema/migration only as required by the spec.
- [ ] Define notification production triggers and recipient model; make writes atomic with the triggering event where needed and idempotent under retries.
- [ ] Implement list, preferences read/write, unread count, and seen watermark routes, scoped to the authenticated DID.
- [ ] Verify cursor semantics, unread count/seen consistency, preference defaults, and concurrency in tests.
- [ ] Build, run tests, format/lint, add changeset, commit, push, and create PR based on PR 1's branch.
- [ ] Record both PR URLs and final verification results here.

## Decisions and constraints

1. Reuse the base PR's public `subjectView` conversion so all endpoints share one enforcement and appeal interpretation.
2. Do not add indexes to `moderation_event` preemptively. Favor existing subject indexes and the smaller `report` table; query plans should justify any new heavy-table index.
3. Each PR needs its own changeset and focused tests. The second PR's diff should contain only the additional notification work against the first.
4. Treat all inbox reads as account-scoped unless the spec explicitly authorizes another actor. Never infer access from a caller-supplied DID alone.
5. Existing `moderation_event_account_reports_idx` and `moderation_event_record_reports_idx` cover reporter-first lookups for report events; `idx_report_event` joins those events to report rows. Existing `moderation_event_subject_did_idx` and subject/action partial indexes cover subject-first lookups. The `report` table has separate active/closed DID indexes and the base PR adds an appeal-subject index. Verify query plans with representative row counts before adding an index.
6. The moderator-facing `tools.ozone.report.getReport/queryReports` view contains private moderation fields and is unsuitable as a caller-facing inbox response. Build an explicitly public report view from permitted columns.
7. The base PR's `hydrateSubjectView` performs multiple DB reads per subject; a list route must bound page size and avoid unbounded per-row hydration. Batch loading is preferable if the spec requires large pages.

## Open questions requiring source verification

- What are the exact lexicon properties and public view types for each method? No schemas for these ten methods exist on the base branch.
- Does `getAccountStatus` return only account enforcement, a summary of reports/actions, or account standing from other services?
- Which report types and subjects are visible to a reporter, and what public note/reason fields may be exposed?
- Are actioned subjects limited to the caller's account and records, or do chat/conversation subjects also appear?
- Which events create notifications, how are duplicates handled, and are preferences per category or global?
- Is `updateSeen` a timestamp watermark or a per-notification operation? What consistency is expected for `getUnreadCount`?
- Should self-service inbox routes allow moderator/admin credentials to query another DID, as `appealActionedSubject` does for submissions, or should every read use the token issuer only?

## Evidence and access notes

- `curl` to the Linear URL returned HTTP 200 with a generic `<title>Linear</title>` shell and `<div id=root>`; no document body was embedded. No Linear connector or token is available in this session. An asynchronous request for the text/export has been sent.
- The workspace contains no occurrences of the ten requested `tools.ozone.inbox.*` method IDs, so there is no local source of their intended schemas.
- The base PR comments do not provide the missing endpoint contracts.

## Resume instructions

Read this file, compare the current branch and worktree with the checklist, then continue from the first unchecked item. Verify the Linear spec body before locking lexicons. Update decisions, open questions, commands/results, and PR URLs as work progresses.
