---
'@atproto/oauth-provider-ui': patch
---

Fix the text color of action buttons. Their custom font size class was mistaken for a text color when merging class names, which dropped the button's own color: primary buttons showed dark text in light mode, and destructive buttons lost their red text.
