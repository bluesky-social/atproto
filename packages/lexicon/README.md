# Lexicon

Lexicon is the semantic schemas & contracts system for ATP. This library provides definitions and APIs for ATP software.

```
npm install @atproto/lexicon
```

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
