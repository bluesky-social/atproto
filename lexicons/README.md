# Canonical Lexicons Directory

This folder contains the canonical lexicons definitions of the `com.atproto` and `tools.ozone` namespaces.

Any change made to these lexicons will be [published](https://atproto.com/specs/lexicon#lexicon-publication-and-resolution) on the AT Protocol once landed on the `main` branch.

The canonical source for the `app.bsky` and `chat.bsky` lexicons is the [bluesky-social/bsky](https://github.com/bluesky-social/bsky) GitHub repository.

Other lexicons namespaces used in this repository are either resolved from the AT Protocol network, or hard wired in the [lexicons-overrides](../lexicons-overrides) directory.

Any lexicon document fetched from the network or the `bsky` GitHub repository is committed (hard wired) into the consuming package for offline builds and CI. Only the canonical `com.atproto` / `tools.ozone` schemas, which each package symlinks back to this directory, are left out of version control there.
