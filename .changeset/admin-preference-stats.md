---
'@atproto/api': patch
'@atproto/pds': patch
---

Add the `com.atproto.admin.getAccountPreferenceStats` query, which reports the size and counts of an account's stored `app.bsky` preferences (including the size of the `app.bsky.actor.putPreferences` body they make up) without their contents
