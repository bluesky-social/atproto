import { describe, expect, it, vi } from 'vitest'
import { CachedGetter, type Getter } from './cached-getter.js'
import type { SimpleStore } from './simple-store.js'
import { swallowStoreErrors } from './swallow-store-errors.js'

type Store = SimpleStore<string, string>

/** An in-memory SimpleStore whose operations can be individually overridden. */
function memoryStore(overrides: Partial<Store> = {}): Store {
  const map = new Map<string, string>()
  return {
    get: async (key) => map.get(key),
    set: async (key, value) => void map.set(key, value),
    del: async (key) => void map.delete(key),
    ...overrides,
  }
}

describe(CachedGetter, () => {
  describe('store error propagation', () => {
    it('propagates errors thrown by the store on read (getStored)', async () => {
      const err = new Error('get failed')
      const getter = vi.fn<Getter<string, string>>(async () => 'fresh')
      const store = memoryStore({
        get: async () => {
          throw err
        },
      })

      const cached = new CachedGetter(getter, store)

      await expect(cached.get('k')).rejects.toBe(err)
      // The getter is never reached because the read failed first.
      expect(getter).not.toHaveBeenCalled()
    })

    it('propagates errors thrown by the store on write (setStored)', async () => {
      const err = new Error('set failed')
      const getter = vi.fn<Getter<string, string>>(async () => 'fresh')
      const store = memoryStore({
        set: async () => {
          throw err
        },
      })

      const cached = new CachedGetter(getter, store)

      await expect(cached.get('k')).rejects.toBe(err)
      expect(getter).toHaveBeenCalledOnce()
    })
  })

  describe('caching behavior', () => {
    it('returns a stored value without calling the getter', async () => {
      const getter = vi.fn<Getter<string, string>>(async () => 'fresh')
      const store = memoryStore()
      await store.set('k', 'stored')

      const cached = new CachedGetter(getter, store)

      await expect(cached.get('k')).resolves.toBe('stored')
      expect(getter).not.toHaveBeenCalled()
    })

    it('calls the getter and persists the result on a cache miss', async () => {
      const getter = vi.fn<Getter<string, string>>(async () => 'fresh')
      const store = memoryStore()
      const setSpy = vi.spyOn(store, 'set')

      const cached = new CachedGetter(getter, store)

      await expect(cached.get('k')).resolves.toBe('fresh')
      expect(getter).toHaveBeenCalledOnce()
      expect(setSpy).toHaveBeenCalledWith('k', 'fresh')
    })

    it('deduplicates concurrent gets for the same key into a single getter call', async () => {
      let resolveGetter: (v: string) => void = () => {}
      let getterCalled: () => void = () => {}
      const getterInvoked = new Promise<void>((r) => (getterCalled = r))
      const getter = vi.fn<Getter<string, string>>(() => {
        getterCalled()
        return new Promise<string>((r) => (resolveGetter = r))
      })
      const store = memoryStore()

      const cached = new CachedGetter(getter, store)

      const a = cached.get('k')
      const b = cached.get('k')
      // Wait for the (single) getter invocation before resolving it, since the
      // getter runs only after the async getStored() read completes.
      await getterInvoked
      resolveGetter('fresh')

      await expect(Promise.all([a, b])).resolves.toEqual(['fresh', 'fresh'])
      expect(getter).toHaveBeenCalledOnce()
    })
  })

  describe('deleteOnError', () => {
    it('deletes the stored value when the getter fails and deleteOnError returns true', async () => {
      const err = new Error('getter failed')
      const getter = vi.fn<Getter<string, string>>(async () => {
        throw err
      })
      const store = memoryStore()
      await store.set('k', 'stale')
      const delSpy = vi.spyOn(store, 'del')

      const cached = new CachedGetter(getter, store, {
        // Force refresh so the getter runs even though a value is stored.
        isStale: () => true,
        deleteOnError: () => true,
      })

      await expect(cached.get('k')).rejects.toBe(err)
      expect(delSpy).toHaveBeenCalledWith('k')
    })
  })

  describe('with swallowStoreErrors (end-to-end cache-miss degradation)', () => {
    it('degrades a failing store read to a refetch from the getter', async () => {
      const getter = vi.fn<Getter<string, string>>(async () => 'fresh')
      const onError = vi.fn()
      const store = memoryStore({
        get: async () => {
          throw new Error('store unavailable')
        },
      })

      const cached = new CachedGetter(
        getter,
        swallowStoreErrors(store, onError),
      )

      // The swallowed read yields `undefined` (cache miss), so the getter is
      // invoked and its value returned — the whole point of the decorator.
      await expect(cached.get('k')).resolves.toBe('fresh')
      expect(getter).toHaveBeenCalledOnce()
      expect(onError).toHaveBeenCalledWith(expect.any(Error), 'get', 'k')
    })

    it('does not reject when the store write fails behind swallowStoreErrors', async () => {
      const getter = vi.fn<Getter<string, string>>(async () => 'fresh')
      const onError = vi.fn()
      const store = memoryStore({
        set: async () => {
          throw new Error('store unavailable')
        },
      })

      const cached = new CachedGetter(
        getter,
        swallowStoreErrors(store, onError),
      )

      await expect(cached.get('k')).resolves.toBe('fresh')
      expect(onError).toHaveBeenCalledWith(expect.any(Error), 'set', 'k')
    })
  })
})
