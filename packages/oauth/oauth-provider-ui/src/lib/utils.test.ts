import { describe, expect, it } from 'vitest'
import { cn } from './utils.ts'

describe(cn, () => {
  it('joins plain class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })

  it('resolves conflicting tailwind utilities in favor of the last one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('keeps non-conflicting tailwind utilities', () => {
    expect(cn('px-2', 'py-4')).toBe('px-2 py-4')
  })

  it('supports conditional object syntax', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active')
  })

  it('resolves conflicts across variant prefixes independently', () => {
    expect(cn('hover:bg-red-500', 'bg-blue-500')).toBe(
      'hover:bg-red-500 bg-blue-500',
    )
  })
})
