---
'@atproto/api': patch
'@atproto/bsky': patch
'@atproto/ozone': patch
---

Add `excludedReportTypes` to `tools.ozone.report.closeReports` to leave matching report reasons unchanged during no-action cleanup. Exclusions take precedence over `reportTypes` within the requested subject scope.
