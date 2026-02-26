import { describe, expect, it } from 'vitest'
import { LexError } from './lex-error.js'

describe(LexError, () => {
  it('stores error code and message', () => {
    const err = new LexError('TestError', 'This is a test error')
    expect(err.error).toBe('TestError')
    expect(err.message).toBe('This is a test error')
  })

  it('strips empty message in toJSON output', () => {
    const err = new LexError('TestError')
    expect(err.toJSON()).toEqual({ error: 'TestError' })
  })

  it('formats string output correctly', () => {
    const err = new LexError('TestError', 'This is a test error')
    expect(err.toString()).toBe('LexError: [TestError] This is a test error')
  })
})
