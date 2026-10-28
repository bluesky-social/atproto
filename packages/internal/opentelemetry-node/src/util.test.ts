import { describe, expect, test } from 'vitest'
import { statusCodeToString } from './util.js'

describe(statusCodeToString, () => {
  test('success is spelled out, since the Code enum has no member for it', () => {
    expect(statusCodeToString(undefined)).toBe('ok')
  })

  test.each([
    { code: 1, expected: 'canceled' },
    { code: 2, expected: 'unknown' },
    { code: 3, expected: 'invalid_argument' },
    { code: 4, expected: 'deadline_exceeded' },
    { code: 5, expected: 'not_found' },
    { code: 6, expected: 'already_exists' },
    { code: 7, expected: 'permission_denied' },
    { code: 8, expected: 'resource_exhausted' },
    { code: 9, expected: 'failed_precondition' },
    { code: 10, expected: 'aborted' },
    { code: 11, expected: 'out_of_range' },
    { code: 12, expected: 'unimplemented' },
    { code: 13, expected: 'internal' },
    { code: 14, expected: 'unavailable' },
    { code: 15, expected: 'data_loss' },
    { code: 16, expected: 'unauthenticated' },
  ])('$expected', ({ code, expected }) => {
    expect(statusCodeToString(code)).toBe(expected)
  })

  test('unknown numeric code falls back to its digits', () => {
    expect(statusCodeToString(9999)).toBe('9999')
  })
})
