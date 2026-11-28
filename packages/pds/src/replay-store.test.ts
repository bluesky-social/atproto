import type { Redis } from 'ioredis'
import { describe, expect, it } from 'vitest'
import { FailOpenReplayStore } from './replay-store.js'

describe('FailOpenReplayStore', () => {
  it('checks nonces in process memory when redis fails', async () => {
    const failing = {
      set: async () => {
        throw new Error('connection refused')
      },
    } as unknown as Redis
    const store = new FailOpenReplayStore(failing)
    expect(await store.unique('dpop', 'a', 60_000)).toBe(true)
    expect(await store.unique('dpop', 'a', 60_000)).toBe(false)
    expect(await store.unique('dpop', 'b', 60_000)).toBe(true)
  })

  it('refuses a replay to the same process across redis failing and recovering', async () => {
    let up = true
    const seen = new Set<string>()
    const flaky = {
      set: async (key: string) => {
        if (!up) throw new Error('connection refused')
        const prev = seen.has(key) ? '1' : null
        seen.add(key)
        return prev
      },
    } as unknown as Redis
    const store = new FailOpenReplayStore(flaky)
    expect(await store.unique('dpop', 'before', 60_000)).toBe(true)
    up = false
    expect(await store.unique('dpop', 'before', 60_000)).toBe(false)
    expect(await store.unique('dpop', 'during', 60_000)).toBe(true)
    up = true
    expect(await store.unique('dpop', 'during', 60_000)).toBe(false)
  })

  it('uses redis while it answers, under the keys ReplayStoreRedis used', async () => {
    const seen = new Set<string>()
    const working = {
      set: async (key: string) => {
        const prev = seen.has(key) ? '1' : null
        seen.add(key)
        return prev
      },
    } as unknown as Redis
    const store = new FailOpenReplayStore(working)
    expect(await store.unique('dpop', 'a', 60_000)).toBe(true)
    expect(await store.unique('dpop', 'a', 60_000)).toBe(false)
    expect([...seen]).toEqual(['nonces:dpop:a'])
  })
})
