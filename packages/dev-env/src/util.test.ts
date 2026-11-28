import { describe, expect, it, vi } from 'vitest'

// @NOTE uniqueLockId keeps module-level state, so each test imports a fresh copy
async function importUniqueLockId() {
  vi.resetModules()
  const { uniqueLockId } = await import('./util.js')
  return uniqueLockId
}

describe('uniqueLockId', () => {
  it('returns every id between 1001 and 2000 exactly once', async () => {
    const uniqueLockId = await importUniqueLockId()

    const ids = Array.from({ length: 1000 }, () => uniqueLockId())

    expect(new Set(ids).size).toBe(1000)
    expect(Math.min(...ids)).toBe(1001)
    expect(Math.max(...ids)).toBe(2000)
  })

  it('throws once every id has been used, instead of hanging', async () => {
    const uniqueLockId = await importUniqueLockId()

    // @NOTE the test timeout can't interrupt a synchronous loop, so bound the
    // number of random draws to make an implementation that retries fail fast
    const random = Math.random
    let draws = 0
    using _ = vi.spyOn(Math, 'random').mockImplementation(() => {
      if (++draws > 100_000) throw new Error('uniqueLockId never returned')
      return random()
    })

    for (let i = 0; i < 1000; i++) uniqueLockId()

    expect(() => uniqueLockId()).toThrow(RangeError)
    expect(() => uniqueLockId()).toThrow(RangeError)
  })
})
