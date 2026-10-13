---
"@atproto/ozone": minor
"@atproto/api": minor
---

Replace the moderation inbox global push preference with independent reports, account, and labels preferences. Support atomic partial updates and preserve existing opt-outs through nullable category columns that inherit the stored global value. Clients must switch to the category fields.
