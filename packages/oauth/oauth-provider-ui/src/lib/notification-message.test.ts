import { describe, expect, it } from 'vitest'
import { errorToNotification } from './notification-message.ts'

describe(errorToNotification, () => {
  it('defaults the variant to error', () => {
    expect(errorToNotification(new Error('boom')).variant).toBe('error')
  })

  it('honours a variant override', () => {
    expect(
      errorToNotification(new Error('boom'), { variant: 'warning' }).variant,
    ).toBe('warning')
  })

  it('uses the override title when one is supplied', () => {
    const result = errorToNotification(new Error('boom'), {
      title: 'Custom title',
    })
    expect(result.title).toBe('Custom title')
  })

  it('falls back to the generic title when none is supplied', () => {
    // The default is a Lingui MessageDescriptor, not a plain string.
    const result = errorToNotification(new Error('boom'))
    expect(result.title).toBeDefined()
    expect(typeof result.title).toBe('object')
  })

  it('derives the description from a plain Error message', () => {
    expect(
      errorToNotification(new Error('Something went wrong')).description,
    ).toBe('Something went wrong')
  })

  it('prefers an override description over the raw Error message', () => {
    const result = errorToNotification(new Error('boom'), {
      description: 'Custom description',
    })
    expect(result.description).toBe('Custom description')
  })

  it('derives the description from a string error', () => {
    expect(errorToNotification('a string').description).toBe('a string')
  })

  it('always returns a title for non-Error inputs', () => {
    expect(errorToNotification(undefined).title).toBeDefined()
    expect(errorToNotification(null).title).toBeDefined()
    expect(errorToNotification({ nope: true }).title).toBeDefined()
  })

  it('does not throw on a circular error object', () => {
    const circular: Record<string, unknown> = { message: 'circular' }
    circular.self = circular
    expect(() => errorToNotification(circular)).not.toThrow()
  })
})
