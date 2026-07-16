import { describe, expect, it } from 'vitest'
import { TypedEventTarget } from '../src/lib/typed-event-target.js'

type TestMap = {
  ping: Event
  data: CustomEvent<{ n: number }>
}

describe(TypedEventTarget, () => {
  it('dispatches and receives a plain Event', () => {
    const t = new TypedEventTarget<TestMap>()
    let seen = false
    t.addEventListener('ping', () => {
      seen = true
    })
    t.dispatchEvent(new Event('ping'))
    expect(seen).toBe(true)
  })

  it('delivers CustomEvent detail to a typed listener', () => {
    const t = new TypedEventTarget<TestMap>()
    const got: number[] = []
    t.addEventListener('data', (ev) => got.push(ev.detail.n))
    t.dispatchEvent(new CustomEvent('data', { detail: { n: 42 } }))
    expect(got).toEqual([42])
  })

  it('removeEventListener detaches', () => {
    const t = new TypedEventTarget<TestMap>()
    let count = 0
    const listener = () => count++
    t.addEventListener('ping', listener)
    t.dispatchEvent(new Event('ping'))
    t.removeEventListener('ping', listener)
    t.dispatchEvent(new Event('ping'))
    expect(count).toBe(1)
  })

  it('honors the per-listener AbortSignal option', () => {
    const t = new TypedEventTarget<TestMap>()
    const ac = new AbortController()
    let count = 0
    t.addEventListener('ping', () => count++, { signal: ac.signal })
    t.dispatchEvent(new Event('ping'))
    ac.abort()
    t.dispatchEvent(new Event('ping'))
    expect(count).toBe(1)
  })
})
