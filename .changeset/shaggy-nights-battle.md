---
'@atproto/api': patch
'@atproto/ozone': patch
---

Add report lifecycle outcome, action breakdown, handling-time, and resolution-time statistics.

Keep aggregate totals separate from unassigned-moderator groups, restore moderator inbound counts.

Index report closure timestamps for daily statistics and combine null and unmatched queue IDs into a single unqueued group.

Reconstruct historical pending counts at the end of each UTC day from report closure and reopen history. Current-day counts remain live; queue breakdowns use current queue membership.
