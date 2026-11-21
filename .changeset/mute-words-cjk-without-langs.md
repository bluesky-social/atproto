---
'@atproto/api': patch
---

Match muted words written in Chinese, Japanese, Korean or Thai script inside posts whatever the post's `langs`, including posts with no `langs`. Substring matching for posts in a language without spaces now applies when any of the post's `langs` is one, not just the first.
