# hashtags

Bluesky supports both inline and outline tags on posts. We want both use cases
to adhere to the same rules to reduce confusion for users. Because of this, some
syntaxes like trailing punctuation are not allowed.

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
