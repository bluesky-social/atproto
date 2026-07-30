import { describe, expect, test } from 'vitest'
import {
  AUTH_STEPS,
  formatStepHash,
  isAuthStep,
  parseStepHash,
} from './location-step.ts'

describe(isAuthStep, () => {
  test.each([
    { value: 'welcome', expected: true },
    { value: 'sign-in', expected: true },
    { value: 'sign-up', expected: true },
    { value: 'reset-password', expected: true },
    { value: 'reset-password-confirm', expected: true },
    { value: 'consent', expected: true },
    { value: 'bogus', expected: false },
    { value: 'Sign-In', expected: false },
    { value: '', expected: false },
    { value: undefined, expected: false },
    { value: null, expected: false },
  ])('$value', ({ value, expected }) => {
    expect(isAuthStep(value)).toBe(expected)
  })
})

describe(parseStepHash, () => {
  describe('invalid inputs', () => {
    test.each([
      { hash: '' },
      { hash: '#' },
      { hash: '#step=' },
      { hash: '#step=bogus' },
      { hash: '#step=Sign-In' },
      { hash: '#other=sign-in' },
      { hash: 'step=sign-in' },
      { hash: '#step=sign-in&extra=1' },
    ])('$hash', ({ hash }) => {
      expect(parseStepHash(hash)).toBeUndefined()
    })
  })
})

describe('roundtrip formatStepHash <-> parseStepHash', () => {
  test.each(AUTH_STEPS.map((step) => ({ step })))('$step', ({ step }) => {
    expect(parseStepHash(formatStepHash(step))).toBe(step)
  })
})
