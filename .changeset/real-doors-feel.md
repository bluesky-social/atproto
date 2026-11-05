---
"@atproto/ozone": minor
---

**Breaking:** Treat the labeler service record's `reasonTypes` as an exact allowlist for `com.atproto.moderation.createReport`. A modern reason is no longer implicitly accepted when only its mapped legacy reason is listed. Unlisted reasons return `InvalidRequest` before creating a report or associated moderation writes.

An omitted `reasonTypes` list continues to accept all reason types. An empty list accepts none. Explicitly listed modern, legacy, and custom reasons remain valid; existing reports retain their original reasons.

Before upgrading, use the updated Ozone labeler configuration editor to explicitly list every reason the labeler should accept. The editor offers current and legacy reasons and preserves existing configured lists and custom values. Verify each labeler's published list and allow for profile propagation and service-record cache refresh before enabling strict validation.

When metrics are enabled with `OZONE_METRICS_PORT`, `ozone_report_reason_rejections_total` counts allowlist rejections from `createReport` and report events through `emitEvent`. Labels identify the endpoint and recognized modern or legacy reason type; other strings share the `unknown` reason bucket. The counter records attempts, including retries, without storing rejected reports. Operators can configure alert thresholds in their monitoring system.
