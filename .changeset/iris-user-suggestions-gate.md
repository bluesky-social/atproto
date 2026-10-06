---
'@atproto/bsky': patch
---

Route user-suggestion endpoints to Iris behind the `suggested_users:iris:enable` feature gate. When enabled, `getSuggestedUsers`, `getSuggestedUsersForDiscover`, `getSuggestedUsersForExplore`, `getSuggestedUsersForSeeMore`, `getSuggestedOnboardingUsers`, `getSuggestions`, and `getSuggestedFollowsByActor` fetch their skeletons from Iris instead of seeemore. `getSuggestions` still falls back to the dataplane when Iris is not configured, and `getSuggestedFollowsByActor` returns an empty list.
