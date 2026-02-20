import { describe, expect, it } from 'vitest'
import { LexError, isLexError } from './lex-error.js'

const kLexError = Symbol.for('@atproto/lex-data/LexError')

class LexErrorSubClass extends LexError {
  toDownstreamError() {
    return { status: 500, data: this.toJSON() }
  }
}

/**
 * Alternative implementation of LexError for testing the isLexError type guard.
 * This class mimics the shape of LexError but does not extend it, to ensure
 * that isLexError correctly identifies it as a LexError instance based on the
 * presence of the kLexError symbol and required properties, rather than relying
 * on class inheritance.
 */
class AlternativeLexError extends Error {
  readonly [kLexError] = kLexError
  error = 'TestError'
  toJSON() {}
  toDownstreamError() {}
}

describe(LexError, () => {
  it('cannot be directly instantiated', () => {
    // @ts-expect-error abstract class should not be directly instantiated
    expect(() => new LexError('TestError', 'This is a test error')).toThrow()
  })

  it('stores error code and message', () => {
    const err = new LexErrorSubClass('TestError', 'This is a test error')
    expect(err.error).toBe('TestError')
    expect(err.message).toBe('This is a test error')
  })

  it(LexError.prototype.toDownstreamError, () => {
    const err = new LexErrorSubClass('TestError', 'This is a test error')
    expect(err.toDownstreamError()).toEqual({
      status: 500,
      data: { error: 'TestError', message: 'This is a test error' },
    })
  })

  it('identifies alternative implementations', () => {
    expect(new AlternativeLexError()).toBeInstanceOf(LexError)
  })

  it('strips empty message in toJSON output', () => {
    const err = new LexErrorSubClass('TestError')
    expect(err.toJSON()).toEqual({ error: 'TestError' })
  })

  it('formats string output correctly', () => {
    const err = new LexErrorSubClass('TestError', 'This is a test error')
    expect(err.toString()).toBe('LexError: [TestError] This is a test error')
  })
})

describe(isLexError, () => {
  it('identifies LexError instances', () => {
    expect(isLexError(new LexErrorSubClass('This is a test error'))).toBe(true)
  })

  it('does not identify objects with similar shape', () => {
    expect(isLexError(new Error('Not a LexError'))).toBe(false)
    expect(
      isLexError({
        [kLexError]: kLexError,
        error: 'TestError',
        message: 'Fake error',
        toJSON() {},
        toDownstreamError() {},
      }),
    ).toBe(false)
  })

  it('identifies alternative implementations', () => {
    expect(isLexError(new AlternativeLexError())).toBe(true)
  })
})
