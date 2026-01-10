import { describe, expect, it } from 'vitest'
import { lexiconDocumentSchema } from '../src/index.js'
import invalidLexicons from './lexicon-invalid.json' with { type: 'json' }
import validLexicons from './lexicon-valid.json' with { type: 'json' }

describe('fixtures', () => {
  describe('valid lexicons', () => {
    for (const { name, lexicon } of validLexicons) {
      it(name, () => {
        expect(lexiconDocumentSchema.parse(lexicon)).toBe(lexicon)
      })
    }
  })

  describe('invalid lexicons', () => {
    for (const { name, lexicon } of invalidLexicons) {
      it(name, () => {
        expect(lexiconDocumentSchema.safeParse(lexicon)).toMatchObject({
          success: false,
        })
      })
    }
  })
})
