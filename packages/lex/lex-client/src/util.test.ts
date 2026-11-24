import { describe, expect, it } from 'vitest'
import { applyDefaults } from './util.js'

describe(applyDefaults, () => {
  it('fills in missing options from defaults', () => {
    expect(applyDefaults({ a: 1 }, { a: 0, b: 2 })).toEqual({ a: 1, b: 2 })
  })

  it('applies defaults over explicitly undefined options', () => {
    expect(applyDefaults({ a: undefined }, { a: 1 })).toEqual({ a: 1 })
  })

  it('preserves explicitly null options', () => {
    expect(applyDefaults({ a: null }, { a: 1 })).toEqual({ a: null })
  })

  it('applies multiple defaults left to right', () => {
    expect(applyDefaults({ a: 1 }, { a: 0, b: 2 }, { b: 3, c: 4 })).toEqual({
      a: 1,
      b: 2,
      c: 4,
    })
  })

  it('does not mutate its inputs', () => {
    const options = { a: undefined }
    const defaults = { a: 1, b: 2 }
    applyDefaults(options, defaults)
    expect(options).toEqual({ a: undefined })
    expect(defaults).toEqual({ a: 1, b: 2 })
  })
})
