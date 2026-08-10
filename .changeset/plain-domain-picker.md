---
'@atproto/oauth-provider-ui': patch
---

Simplify the sign-up username step. The domain is no longer a listbox nested inside the text input: with several domains available it becomes a list of radio rows under the input, and with only one it becomes a preview of the resulting username. The two validation rows collapse into a single hint, and the terms-of-service disclaimer moves to the final step, which is the step that creates the account.
