import { randomIntFromSeed } from '../src'

describe('randomIntFromSeed()', () => {
  it('has good distribution for low bucket count.', async () => {
    const counts: [zero: number, one: number] = [0, 0]
    const salt = Math.random()
    for (let i = 0; i < 10000; ++i) {
      const int = await randomIntFromSeed(`${i}${salt}`, 2)
      counts[int]++
    }
    const [zero, one] = counts
    expect(zero + one).toEqual(10000)
    expect(Math.max(zero, one) / Math.min(zero, one)).toBeLessThan(1.05)
  })
})
