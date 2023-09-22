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

MIT
