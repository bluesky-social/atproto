# hashtags

Bluesky supports both inline and "outline" tags on posts. We want both use cases
to adhere to the same rules to reduce confusion for users. Because of this, some
syntaxes like trailing punctuation are not allowed.

The regexes we use are otherwise very permissive. We match values using the
Unicode Character Category `L` to capture letters from all languages, as well as
integers `0-9`, underscores `_`, and hyphens `-`. Lastly, we aim to support all
emoji.

Rules:

- must start with a letter or emoji / cannot start with a number or punctuation
- can contain only letters, numbers, emoji, `_`, and `-`
- cannot end with punctuation

Examples:

| Value          | Sanitized Value | Notes |
| -------------- | --------------- | ----- |
| tag            | tag             |       |
| tag_tag        | tag_tag         |       |
| tag-tag        | tag-tag         |       |
| l33t           | l33t            |       |
| 🦋             | 🦋              |       |
| butter🦋fly    | butter🦋fly     |       |
| tag\_          | tag             |       |
| \_tag          | tag             |       |
| tag-           | tag             |       |
| -tag           | tag             |       |
| 0x             | x               |       |
| pun.ctu.ati.on | punctuation     |       |
