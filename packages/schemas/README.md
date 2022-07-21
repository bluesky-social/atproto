# ADX Schemas Library

This is a toolkit for validating ADX Schemas. See [DESIGN.md](./DESIGN.md) for more information about how ADX Schemas work.

```
npm install @adxp/schemas
```

## Usage

```typescript
import { AdxSchemas } from '@adxp/schemas'

// example schema: "Zeets"
const ublogSchema = {
  $type: 'adxs-record',
  author: 'blueskyweb.xyz',
  name: 'Ublog',
  locale: {
    en: {
      nameSingular: 'Micro-blog Post',
      namePlural: 'Micro-blog Posts',
    }
  },
  schema: {
    type: 'object',
    required: ['text', 'createdAt'],
    properties: {
      text: { type: 'string', maxLength: 256 },
      createdAt: { type: 'string', format: 'date-time' }
    }
  }
}

// create your schemas collection
const schemas = new AdxSchemas()
schemas.add(ublogSchema)
schemas.add(pollSchema) // pollSchema's definition not included for brevity

// create a validator
const ublogValidator = schemas.createRecordValidator({
  type: 'UBlog', // base type (required). Can be an array.
  ext: ['Poll'] // extension types (optional)
})

// now we can validate records with...
ublogValidator.validate({/*..*/}) // => returns a result
ublogValidator.isValid({/*..*/}) // => returns a boolean
ublogValidator.assertValid({/*..*/}) // => returns a result on success, throws on fail
```

Some examples of validation:

```typescript
// a valid record
// --------------
const res1 = ublogValidator.validate({
  $type: 'blueskyweb.xyz:UBlog',
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
const res2 = ublogValidator.validate({
  $type: 'blueskyweb.xyz:UBlog',
  text: 'Hello, world!',
  createdAt: 12345 // <-- wrong type!
})
res2.compatible     // => true
res2.valid          // => false
res2.fullySupported // => false
res2.error          // => `Failed blueskyweb.xyz:UBlog validation for #/properties/createdAt/type: must be string`
res2.fallbacks      // => []

// an unsupported record type
// --------------------------
const res3 = ublogValidator.validate({
  $type: 'other.org:Fret', // <-- not one of our declared schemas!
  text: 'Hello, world!',
  createdAt: '2022-06-28T22:17:33.459Z'
})
res3.compatible     // => false
res3.valid          // => false
res3.fullySupported // => false
res3.error          // => `Record type other.org:Fret is not supported`
res3.fallbacks      // => []

// a valid record with an extension
// --------------------------------
const res4 = ublogValidator.validate({
  $type: 'blueskyweb.xyz:UBlog',
  text: 'Hello, world!',
  createdAt: '2022-06-28T22:17:33.459Z',
  $ext: {
    'blueskyweb.xyz:Poll': {
      $required: true,
      $fallback: {
        en: 'This zeet includes a poll which this application does not support.',
      },
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
const res5 = ublogValidator.validate({
  $type: 'blueskyweb.xyz:UBlog',
  text: 'Hello, world!',
  createdAt: '2022-06-28T22:17:33.459Z',
  $ext: {
    'other.org:Poll': { // <-- we don't understand this type
      $required: false, // <-- ...but it's not required
      $fallback: {
        en: 'This zeet includes a poll which this application does not support.',
      },
      question: "Do you like ADX's schemas system?",
      answers: ['yes', 'no', 'eh'],
    },
  },
})
res5.compatible     // => true
res5.valid          // => true
res5.fullySupported // => false
res5.error          // => undefined
res5.fallbacks      // => ['This zeet includes a poll which this application does not support.']
```
