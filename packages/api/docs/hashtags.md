# hashtags

Bluesky supports both inline and "outline" tags on posts. Both use cases should
adhere to the same rules to reduce confusion for users.

The regexes we currently use are otherwise very permissive. We match values using the
Unicode Character Category `L` to capture letters from all languages, as well as
integers `0-9`, underscores `_`, and hyphens `-`. Lastly, we aim to support all
emoji.

**Rules**

- must start with a letter or emoji / cannot start with a number or punctuation
- can contain only letters, numbers, emoji, `_`, and `-`
- cannot end with punctuation of any kind
- must not be more than 64 characters or 640 bytes (enforced by Lexicon)

## Sanitization

Because the rules that dictate valid hashtags may need to change over time (due
to new emojis being introduced, or due to poor initial specs) the decision was
made to allow all characters in the hashtag rules, but then apply sanitization
when reading and writing the tags. This ensures that changes to the "valid hashtag"
rules will not break existing records.

You should sanitize a hashtag string:

- before saving it to a record,
- before rendering the hashtag, and
- before comparing hashtags to each other.

This should include abiding by the rules listed above, as well as removing the
leading `#` mark. We've provided a util for this purpose:

```typescript
import { sanitizeHashtag } from '@atproto/api'

sanitizeHashtag('#tag') // => tag
```

**Examples**

| Value          | Sanitized Value |
| -------------- | --------------- |
| tag            | tag             |
| tag_tag        | tag_tag         |
| tag-tag        | tag-tag         |
| l33t           | l33t            |
| 🦋             | 🦋              |
| butter🦋fly    | butter🦋fly     |
| tag\_          | tag             |
| \_tag          | tag             |
| tag-           | tag             |
| -tag           | tag             |
| 0x             | x               |
| pun.ctu.ati.on | punctuation     |

## Validation

In cases where you need to validate a hashtag, you can use the provided util:

```typescript
import { validateHashtag } from '@atproto/api'

validateHashtag('#tag') // => true
```
