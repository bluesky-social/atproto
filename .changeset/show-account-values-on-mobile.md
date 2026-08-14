---
'@atproto/oauth-provider-ui': patch
---

Show the current email address and username on the account management screen at every viewport width. They were previously hidden below the `sm` breakpoint, so on mobile the rows gave no indication of what the setting was currently set to. The update-email dialog now names the address it is replacing, and email addresses quoted in dialog copy wrap instead of overflowing the dialog.
