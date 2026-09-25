# Mod inbox endpoint implementation plan

Updated: 2026-09-25. This file is the handoff record for work across agent sessions.

## Goal and stack

- Base: [atproto PR #5459](https://github.com/bluesky-social/atproto/pull/5459), branch `ozone/mod-inbox/appeal`.
- PR 1: `tools.ozone.inbox.getAccountStatus`, `listReports`, `getReport`, `listActionedSubjects`, `getActionedSubject`, with tests. Target base: `ozone/mod-inbox/appeal`.
- PR 2: `tools.ozone.inbox.listNotifications`, `getNotificationPreferences`, `putNotificationPreferences`, `getUnreadCount`, `updateSeen`, with tests. Target base: PR 1's branch.
- Source contract: [Linear mod inbox tech spec](https://linear.app/blueskyweb/document/mod-inbox-tech-spec-0c36ca149153), provided locally as `/Users/foysal/Projects/bluesky/mod-inbox-spec.md` (1,813 lines). The direct URL serves only the Linear JavaScript shell here; use the local copy.

## Current state

- [x] Confirmed clean checkout at PR #5459's head branch.
- [x] Read repository guidance, testing guidance, and existing inbox appeal/view code.
- [x] Confirmed the base PR provides `appealActionedSubject`, inbox `defs`, subject hydration, and appeal tests.
- [x] Created branch `ozone/mod-inbox/read` from the base PR branch and committed the plan.
- [x] Inspected the existing `report` and `moderation_event` indexes. No new large-table index has been proposed.
- [x] Obtain the spec body: the user supplied `mod-inbox-spec.md` at the workspace root.
- [x] Read the exact request/response shapes and authorization, pagination, privacy, and notification sections of the local spec. Contract inconsistencies are recorded below.

## PR 1 checklist

- [x] Add lexicons for five read methods and shared definitions; ran root `pnpm codegen` and built `@atproto/api`.
- [x] Add per-DID, per-section read watermarks in this PR because `listReports`, `listActionedSubjects`, and `getActionedSubject` require `isRead` and the first two have unread filtering. PR 2's `updateSeen` will write them.
- [x] Implement authenticated Ozone routes under `packages/ozone/src/api/inbox`, register them in `src/api/index.ts`; subject routes delegated to `codex-bsky` and under review.
- [x] Reuse existing subject/appeal view builders. Scope every read to the authenticated DID; avoid exposing moderator notes, reporter identities, or private event metadata.
- [x] Use keyset pagination with deterministic tie breaking for both lists; cursor and ownership cases covered by focused tests.
- [ ] Inspect existing `report` and `moderation_event` indexes and query plans. Existing relevant indexes are documented below, and no `moderation_event` index was added; production-scale plan evidence remains unavailable in the local fixture.
- [x] Add route/integration tests for account isolation, pagination, missing resources, action attribution, report privacy, read state, and response shape. Four focused suites passed: 76 tests total.
- [x] Build, typecheck, run focused tests, format/lint changed files, add a changeset for each touched package. Focused Ozone/PDS builds, test typecheck, formatting, lint, 76 focused tests, root `pnpm run build --force`, and root `pnpm run verify` passed. Changeset `.changeset/blue-carpets-fetch.md` covers Ozone/API minor and PDS patch.
- [x] Committed and pushed; draft PR [#5550](https://github.com/bluesky-social/atproto/pull/5550) targets `ozone/mod-inbox/appeal`.
- [x] Added moderator-only optional `did` preview parameters to `listReports` and `listActionedSubjects` for the Ozone UI. Omitted/self DID keeps viewer behavior; cross-account reads require an active moderator, triage, or admin bearer credential. Eleven focused tests across three suites pass.
- [x] Extended `getReport` and `getActionedSubject` with the same moderator-only `did` preview parameter so Ozone can expand rows. Cross-account reads still require an active moderator, triage, or admin credential; report IDs and subjects remain scoped to the selected DID.
- [x] Moderator-submitted appeals now attribute the appeal report to the affected user's DID and retain the acting moderator's DID in event metadata. The Ozone UI can invoke this on the user's behalf from an eligible actioned subject.

## PR 2 checklist

- [x] Add notification lexicons and an Ozone-owned notification/preference table; index only the new notification table.
- [x] Define notification production triggers and recipient model; write inside report/event transactions with unique source keys. Standing changes on strike expiry use a per-subject transaction.
- [x] Implement list, preferences read/write, unread count, and seen watermark routes, scoped to the authenticated DID.
- [x] Verify cursor semantics, unread count/seen consistency, preference defaults, and concurrency in tests. Both focused suites pass (13 tests total).
- [x] Build, run tests, format/lint, add changeset, commit, push, and create PR based on PR 1's branch.
- [x] Record both PR URLs and final verification results here.

## PR status

- PR 1: [#5550](https://github.com/bluesky-social/atproto/pull/5550) (draft), head `ozone/mod-inbox/read`, base `ozone/mod-inbox/appeal`.
- PR 2: [#5551](https://github.com/bluesky-social/atproto/pull/5551) (draft), head `ozone/mod-inbox/notifications`, base `ozone/mod-inbox/read`; initial implementation commit `bf91b7d34`.

## PR 2 progress and remaining review

- Implemented notification writes at individual report activity, both bulk report paths, public moderation actions, standing changes from moderation events (including record strikes), and strike expiry. The producer suite passed 8 tests; the route suite passed 5 tests.
- Public capabilities advertise `inApp`. The new preference is stored for future Courier use. Ozone has no Courier transport configured in this branch; push delivery and the durable outbox remain unimplemented because the source spec explicitly leaves their infrastructure undesigned. Do not advertise `push` until that infrastructure exists.
- The spec prose says `appealResolved` carries its `publicNote` as a body, but its notification lexicon contains no body field. Added an optional `notification.body` for public notes and tested appeal resolution and report-note payloads. This is an additive contract choice requiring review.
- `updateSeen` serializes writes per DID with a transaction advisory lock, applies the greatest requested/existing watermark to all requested sections, and returns that actual applied timestamp. A concurrent and future-clamp test passes.
- Verification: root `pnpm codegen`, `pnpm run build --force`, and `pnpm run verify` passed; Ozone test typecheck and 13 focused tests passed. Four existing regression suites passed 20 tests. No index was added to `moderation_event` or another existing heavy table.
- The implementation and both stacked PRs are published. Remaining review topics are the deliberately unimplemented Courier delivery/outbox and the first PR's exact standing-transition timestamp limitation.

## PR 2 implementation decisions

- Use the spec's watermark rule (`createdAt <= seenAt`) for notification read state; do not persist per-notification `isRead` despite the contradictory storage sketch.
- Keep notification report IDs equal to `report.id`, matching `listReports`, `getReport`, and Ozone's `/reports/[id]` route.
- Align `standingRef` values with the actual standing lexicon (`good`, `warning`, `atRisk`), not the conflicting example (`limited`, `suspended`).
- Add `inApp` to the public `getCapabilities.channels` vocabulary so an instance without Courier can truthfully advertise the inbox. Include `push` only when push delivery is configured.
- Implement in-app notification persistence and transactional hooks with unique source keys. Courier delivery is described as unscoped in the source spec; decide its transport/outbox scope after the in-app API and event hooks are concrete.
- Add `notification.body` as an optional public-note payload. Keep `publicNote` out of notifications when absent; never expose `internalNote`.
- Apply concurrent `updateSeen` calls under a per-DID advisory lock and return the monotonic watermark actually stored in each requested section.

## Decisions and constraints

1. Reuse the base PR's public `subjectView` conversion so all endpoints share one enforcement and appeal interpretation.
2. Do not add indexes to `moderation_event` preemptively. Favor existing subject indexes and the smaller `report` table; query plans should justify any new heavy-table index.
3. Each PR needs its own changeset and focused tests. The second PR's diff should contain only the additional notification work against the first.
4. Treat all inbox reads as account-scoped unless the spec explicitly authorizes another actor. Never infer access from a caller-supplied DID alone.
5. Existing `moderation_event_account_reports_idx` and `moderation_event_record_reports_idx` cover reporter-first lookups for report events; `idx_report_event` joins those events to report rows. Existing `moderation_event_subject_did_idx` and subject/action partial indexes cover subject-first lookups. The `report` table has separate active/closed DID indexes and the base PR adds an appeal-subject index. Verify query plans with representative row counts before adding an index.
6. The moderator-facing `tools.ozone.report.getReport/queryReports` view contains private moderation fields and is unsuitable as a caller-facing inbox response. Build an explicitly public report view from permitted columns.
7. The base PR's `hydrateSubjectView` performs multiple DB reads per subject; a list route must bound page size and avoid unbounded per-row hydration. Batch loading is preferable if the spec requires large pages.
8. Use the fully specified account standing lexicon (`good`, `warning`, `atRisk`) despite the conflicting JSON example (`good`, `limited`, `suspended`). For an untouched account, use a stable epoch `updatedAt`; a future standing-transition ledger is needed for exact transition times, especially strike expiry.
9. The list-reports lexicon is extended to include chat message/conversation refs because the spec promises all submitted reports and the detail lexicon includes those refs. Report IDs are `report.id`, consistently across list, detail, notifications, and Ozone's `/reports/[id]` route. The read query still joins `moderation_event` to verify the reporting account and construct the subject.
10. The PDS catchall proxy admits `AuthScope.Takendown` only for `tools.ozone.inbox.*`, allowing taken-down users to reach these viewer routes through the mandatory `atproto-proxy` header.
11. New `closeActivity` rows from report-linked moderation actions carry `meta.actionEventId`. The viewer read path uses this to attribute `resolution.actionTaken` to the current close. Legacy rows without that link use a narrow creation-time correlation; an old linked action is never used merely because it remains in `actionEventIds`.
12. For Ozone UI moderator preview, both list endpoints and their matching detail endpoints accept optional `did`. The standard verifier still authenticates the caller and checks disabled team membership. A different DID requires moderator, triage, or admin role; all list, detail, and read-watermark queries use the selected DID. Other inbox methods remain issuer-scoped.
13. An appeal filed by a moderator on behalf of a user is represented as the affected user's appeal report, with the moderator's DID recorded in `appealSubmittedBy` event metadata for attribution. This lets the user's inbox show the pending appeal without exposing the moderator identity in the public view.

## Open questions requiring source verification

- The spec's account status example says `good`/`limited`/`suspended`, but its lexicon and derivation table say `good`/`warning`/`atRisk`. Treat the lexicon and derivation table as authoritative unless corrected.
- The list-reports chat union and report ID choices are resolved in decision 9 above. Notifications in PR 2 must use `report.id` as the report reference.
- `getActionedSubject` promises full action history while the base view loader caps events at 50. Add an uncapped detail path with a safe bound or pagination decision.
- `getAccountStatus.updatedAt` is defined as the last derived standing change, but no standing transition log exists. Decide whether to add one or derive a defensible timestamp from strike/enforcement state.
- Notification persistence/delivery is explicitly unscoped in the spec. Decide Courier integration and outbox schema in PR 2; in-app API requirements are concrete.
- Moderator preview is authorized for list and detail reads, as described in decision 12. Other inbox methods remain issuer-scoped.

## Evidence and access notes

- `curl` to the Linear URL returned HTTP 200 with a generic `<title>Linear</title>` shell and `<div id=root>`; no document body was embedded. The user supplied the complete local Markdown spec after an asynchronous request.
- The workspace contains no occurrences of the ten requested `tools.ozone.inbox.*` method IDs, so there is no local source of their intended schemas.
- The base PR comments do not provide the missing endpoint contracts.

## Resume instructions

Read this file, compare the current branch and worktree with the checklist, then continue from the first unchecked item. Verify the Linear spec body before locking lexicons. Update decisions, open questions, commands/results, and PR URLs as work progresses.
