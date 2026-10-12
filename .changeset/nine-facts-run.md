---
'@atproto/ozone': minor
---

Temporarily disable wildcard label queries by default to prevent expensive prefix scans. Set OZONE_LABEL_QUERY_WILDCARDS_ENABLED=true to restore support; exact URI queries remain available.
