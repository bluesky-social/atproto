import { describe, expect, it } from 'vitest'
import { l } from '@atproto/lex-schema'
import * as com from './lexicons/com.js'

describe('com.example.token', () => {
  describe.each(['main', 'myToken', 'anotherToken'] as const)('%s', (hash) => {
    const token = l.$type(`com.example.token`, hash)

    it('identifies the token correctly', () => {
      expect(com.example.token[hash].$matches(token)).toBe(true)
    })

    it('parses the token correctly', () => {
      expect(com.example.token[hash].$parse(token)).toBe(token)
    })

    it('json serializes the token correctly', () => {
      expect(com.example.token[hash].toJSON()).toBe(token)
    })

    it('stringifies the token correctly', () => {
      expect(com.example.token[hash].toString()).toBe(token)
    })
  })
})
