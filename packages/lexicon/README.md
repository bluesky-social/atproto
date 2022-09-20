# Lexicon

Lexicon is the semantic schemas & contracts system for ADX. This library provides definitions and APIs for ADX software.

```
npm install @adxp/lexicon
```

## Usage

### XRPC method schemas

TODO

### Record schemas

```typescript
import { RecordSchemas } from '@adxp/lexicon'

// create your schemas collection
const schemas = new RecordSchemas()

// example schema: "posts"
schemas.add({
  lex: 1,
  id: 'com.example.post',
  type: 'record',
  record: {
    type: 'object',
    required: ['text', 'createdAt'],
    properties: {
      text: { type: 'string', maxLength: 256 },
      createdAt: { type: 'string', format: 'date-time' }
    }
  }
})
schemas.add(pollSchema) // pollSchema's definition not included for brevity

// create a validator
const postValidator = schemas.createValidator({
  type: 'com.example.post', // base type (required). Can be an array.
  ext: ['com.example.poll'] // extension types (optional)
})

// now we can validate records with...
postValidator.validate({/*..*/}) // => returns a result
postValidator.isValid({/*..*/}) // => returns a boolean
postValidator.assertValid({/*..*/}) // => returns a result on success, throws on fail
```

Some examples of validation:

```typescript
// a valid record
// --------------
const res1 = postValidator.validate({
  $type: 'com.example.post',
  text: 'Hello, world!',
  createdAt: '2022-06-28T22:17:33.459Z'
})
res1.compatible     // => true
res1.valid          // => true
res1.fullySupported // => true
res1.error          // => undefined
res1.fallbacks      // => []

// an invalid record
// -----------------
const res2 = postValidator.validate({
  $type: 'com.example.post',
  text: 'Hello, world!',
  createdAt: 12345 // <-- wrong type!
})
res2.compatible     // => true
res2.valid          // => false
res2.fullySupported // => false
res2.error          // => `Failed com.example.post validation for #/properties/createdAt/type: must be string`
res2.fallbacks      // => []

// an unsupported record type
// --------------------------
const res3 = postValidator.validate({
  $type: 'org.other.post', // <-- not one of our declared schemas!
  text: 'Hello, world!',
  createdAt: '2022-06-28T22:17:33.459Z'
})
res3.compatible     // => false
res3.valid          // => false
res3.fullySupported // => false
res3.error          // => `Record type org.other.post is not supported`
res3.fallbacks      // => []

// a valid record with an extension
// --------------------------------
const res4 = postValidator.validate({
  $type: 'com.example.post',
  text: 'Hello, world!',
  createdAt: '2022-06-28T22:17:33.459Z',
  $ext: {
    'com.example.poll': {
      $required: true,
      $fallback: 'This post includes a poll which this application does not support.',
      question: "Do you like ADX's schemas system?",
      answers: ['yes', 'no', 'eh'],
    },
  },
})
res4.compatible     // => true
res4.valid          // => true
res4.fullySupported // => true
res4.error          // => undefined
res4.fallbacks      // => []

// a valid record with an unsupported-but-optional extension
// ---------------------------------------------------------
const res5 = postValidator.validate({
  $type: 'com.example.post',
  text: 'Hello, world!',
  createdAt: '2022-06-28T22:17:33.459Z',
  $ext: {
    'org.other.poll': { // <-- we don't understand this type
      $required: false, // <-- ...but it's not required
      $fallback: 'This post includes a poll which this application does not support.',
      question: "Do you like ADX's schemas system?",
      answers: ['yes', 'no', 'eh'],
    },
  },
})
res5.compatible     // => true
res5.valid          // => true
res5.fullySupported // => false
res5.error          // => undefined
res5.fallbacks      // => ['This post includes a poll which this application does not support.']
```
