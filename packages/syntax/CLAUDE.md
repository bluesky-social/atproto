# @atproto/syntax — Identifier + format validators

Validators for atproto-shaped strings: DIDs, handles, NSIDs, AT-URIs, record keys, TIDs. Used everywhere an untrusted input claims to be one of these.

## Don't bypass

If you're handling a user-supplied string that should be one of the above, run it through here. Manual regex checks scattered across the codebase are how we get bugs.
