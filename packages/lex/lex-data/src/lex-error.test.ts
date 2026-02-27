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

  it('includes message in toJSON when present', () => {
    const err = new LexError('TestError', 'details here')
    expect(err.toJSON()).toEqual({
      error: 'TestError',
      message: 'details here',
    })
  })

  it('formats string output correctly', () => {
    const err = new LexError('TestError', 'This is a test error')
    expect(err.toString()).toBe('LexError: [TestError] This is a test error')
  })

  it('uses constructor name for the name property', () => {
    const err = new LexError('TestError')
    expect(err.name).toBe('LexError')
  })

  it('subclasses use their own constructor name', () => {
    class MyCustomError extends LexError {
      // name will be set to this.constructor.name = 'MyCustomError'
    }
    const err = new MyCustomError('CustomCode', 'custom message')
    expect(err.name).toBe('MyCustomError')
    expect(err.toString()).toBe('MyCustomError: [CustomCode] custom message')
  })

  it('preserves cause option', () => {
    const cause = new Error('original')
    const err = new LexError('TestError', 'wrapped', { cause })
    expect(err.cause).toBe(cause)
  })

  it('is an instance of Error', () => {
    const err = new LexError('TestError')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(LexError)
  })
})
