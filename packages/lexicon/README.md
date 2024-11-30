# @atproto/lexicon: schema validation library

TypeScript implementation of the Lexicon data and API schema description language, which is part of [atproto](https://atproto.com).

[![NPM](https://img.shields.io/npm/v/@atproto/lexicon)](https://www.npmjs.com/package/@atproto/lexicon)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## Usage

```typescript
import { Lexicons } from '@atproto/lexicon'

// create your lexicons collection
const lex = new Lexicons()

// add lexicon documents
lex.add({
  lex: 1,
  id: 'com.example.post',
  defs: {
    // ...
  }
})

// validate
lex.assertValidRecord('com.example.record', {$type: 'com.example.record', ...})
lex.assertValidXrpcParams('com.example.query', {...})
lex.assertValidXrpcInput('com.example.procedure', {...})
lex.assertValidXrpcOutput('com.example.query', {...})
```

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
