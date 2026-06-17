import { assert, describe, expect, test } from 'vitest'
import { lexiconDocumentSchema } from '../src/index.js'
import invalidLexicons from './lexicon-invalid.json' with { type: 'json' }
import validLexicons from './lexicon-valid.json' with { type: 'json' }

describe('fixtures', () => {
  describe('valid lexicons', () => {
    test.each(validLexicons)('$name', ({ lexicon }) => {
      expect(lexiconDocumentSchema.parse(lexicon)).toBe(lexicon)
    })
  })

  describe('invalid lexicons', () => {
    test.each(invalidLexicons)('$name', ({ lexicon }) => {
      const result = lexiconDocumentSchema.safeParse(lexicon)
      assert(!result.success)
    })
  })
})
