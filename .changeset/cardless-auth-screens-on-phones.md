---
'@atproto/oauth-provider-ui': patch
---

Drop the card frame from the authorization screens on small viewports. Below `sm` (40rem) the card's surface, ring and radius are removed and the branding background image is replaced by the card surface — with no opaque card left to sit on, copy over a background image would be illegible. This covers the OAuth popup, which `@atproto/oauth-client-browser` opens at 600x600 by default: the window is already the dialog, so the card inside it was a card inside a card, with the background image showing only as slivers down either side. Below `xs` (30rem) the content additionally runs edge to edge and the footer is pinned to the bottom of the viewport, with the content centred in the space above it. At or above 40rem the screens are unchanged.
