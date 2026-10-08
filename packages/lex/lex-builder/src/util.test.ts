import { describe, expect, expectTypeOf, it } from 'vitest'
import { negate } from './util.js'

describe(negate, () => {
  it('should negate true to false', () => {
    const fn = () => true as const
    const negated = negate(fn)
    expectTypeOf(negated).toEqualTypeOf<() => false>()
    expect(negated()).toBe(false)
  })

  it('should negate false to true', () => {
    const fn = () => false as const
    const negated = negate(fn)
    expectTypeOf(negated).toEqualTypeOf<() => true>()
    expect(negated()).toBe(true)
  })

  it('should allow any number of arguments', () => {
    const fn = (arg: string, num: number) => arg.length > 0 && num > 0
    const negated = negate(fn)
    expectTypeOf(negated).toEqualTypeOf<(arg: string, num: number) => boolean>()
    expect(negated('', 0)).toBe(true)
    expect(negated('non-empty', 1)).toBe(false)
  })
})
