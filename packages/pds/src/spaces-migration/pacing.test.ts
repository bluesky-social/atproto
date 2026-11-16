import { backoffMs, jitterDelayMs } from './pacing.js'

describe('jitterDelayMs', () => {
  const window = 24 * 60 * 60 * 1000

  it('is deterministic per hostname', () => {
    expect(jitterDelayMs('pds.example.com', window)).toBe(
      jitterDelayMs('pds.example.com', window),
    )
    expect(jitterDelayMs('pds.example.com', window)).not.toBe(
      jitterDelayMs('other.example.com', window),
    )
  })

  it('falls within the window', () => {
    for (let i = 0; i < 100; i++) {
      const delay = jitterDelayMs(`host${i}.example.com`, 1000)
      expect(Number.isInteger(delay)).toBe(true)
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(delay).toBeLessThan(1000)
    }
  })

  it('is zero with an empty window', () => {
    expect(jitterDelayMs('pds.example.com', 0)).toBe(0)
  })
})

describe('backoffMs', () => {
  const noJitter = () => 0.5

  it('doubles with each attempt', () => {
    expect(backoffMs(0, 1000, 60_000, noJitter)).toBe(1000)
    expect(backoffMs(1, 1000, 60_000, noJitter)).toBe(2000)
    expect(backoffMs(2, 1000, 60_000, noJitter)).toBe(4000)
    expect(backoffMs(5, 1000, 60_000, noJitter)).toBe(32_000)
  })

  it('caps', () => {
    expect(backoffMs(6, 1000, 60_000, noJitter)).toBe(60_000)
    expect(backoffMs(10_000, 1000, 60_000, noJitter)).toBe(60_000)
  })

  it('jitters by up to 20% either way', () => {
    expect(backoffMs(1, 1000, 60_000, () => 0)).toBe(1600)
    expect(backoffMs(1, 1000, 60_000, () => 1)).toBe(2400)
    expect(backoffMs(10, 1000, 60_000, () => 1)).toBe(72_000)
  })
})
