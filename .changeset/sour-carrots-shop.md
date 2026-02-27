---
'@atproto/syntax': minor
---

Remove global `Date.toISOString()` overload and replace with more accurate, less permissive, `AtprotoDate` interface. This change prevent using any `Date` instance to generate a `DatetimeString`, since some JS dates can actually not be safely stringified to a `DatetimeString`.
