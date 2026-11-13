import { describe, expect, it, vi } from 'vitest'
import type { SimpleStore } from './simple-store.js'
import {
  type StoreErrorHandler,
  swallowStoreErrors,
} from './swallow-store-errors.js'

type TestStore = SimpleStore<string, string>

describe(swallowStoreErrors, () => {
  describe('happy path (no errors)', () => {
    it('passes get value, key and options through unchanged', async () => {
      const signal = new AbortController().signal
      const get = vi.fn(async () => 'value')
      const store: TestStore = { get, set: async () => {}, del: async () => {} }
      const onError = vi.fn<StoreErrorHandler<string>>()

      const wrapped = swallowStoreErrors(store, onError)

      await expect(wrapped.get('key', { signal })).resolves.toBe('value')
      expect(get).toHaveBeenCalledWith('key', { signal })
      expect(onError).not.toHaveBeenCalled()
    })

    it('passes set/del arguments through unchanged', async () => {
      const set = vi.fn(async () => {})
      const del = vi.fn(async () => {})
      const store: TestStore = { get: async () => undefined, set, del }
      const onError = vi.fn<StoreErrorHandler<string>>()

      const wrapped = swallowStoreErrors(store, onError)

      await wrapped.set('key', 'value')
      await wrapped.del('key')

      expect(set).toHaveBeenCalledWith('key', 'value')
      expect(del).toHaveBeenCalledWith('key')
      expect(onError).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('swallows get errors, calls handler with "get"+key, returns undefined', async () => {
      const err = new Error('get boom')
      const store: TestStore = {
        get: async () => {
          throw err
        },
        set: async () => {},
        del: async () => {},
      }
      const onError = vi.fn<StoreErrorHandler<string>>()

      const wrapped = swallowStoreErrors(store, onError)

      await expect(wrapped.get('key')).resolves.toBeUndefined()
      expect(onError).toHaveBeenCalledOnce()
      expect(onError).toHaveBeenCalledWith(err, 'get', 'key')
    })

    it('swallows set errors, calls handler with "set"+key, resolves', async () => {
      const err = new Error('set boom')
      const store: TestStore = {
        get: async () => undefined,
        set: async () => {
          throw err
        },
        del: async () => {},
      }
      const onError = vi.fn<StoreErrorHandler<string>>()

      const wrapped = swallowStoreErrors(store, onError)

      await expect(wrapped.set('key', 'value')).resolves.toBeUndefined()
      expect(onError).toHaveBeenCalledWith(err, 'set', 'key')
    })

    it('swallows del errors, calls handler with "del"+key, resolves', async () => {
      const err = new Error('del boom')
      const store: TestStore = {
        get: async () => undefined,
        set: async () => {},
        del: async () => {
          throw err
        },
      }
      const onError = vi.fn<StoreErrorHandler<string>>()

      const wrapped = swallowStoreErrors(store, onError)

      await expect(wrapped.del('key')).resolves.toBeUndefined()
      expect(onError).toHaveBeenCalledWith(err, 'del', 'key')
    })

    it('defaults to logging to the console when no handler is provided', async () => {
      using consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const store: TestStore = {
        get: async () => {
          throw new Error('boom')
        },
        set: async () => {},
        del: async () => {},
      }

      const wrapped = swallowStoreErrors(store)

      await expect(wrapped.get('key')).resolves.toBeUndefined()
      expect(consoleError).toHaveBeenCalledOnce()
    })

    it('propagates a get error (does not log it) when the caller signal aborted', async () => {
      const controller = new AbortController()
      const err = new Error('aborted')
      const store: TestStore = {
        get: async (_key, options) => {
          options?.signal?.throwIfAborted()
          throw err
        },
        set: async () => {},
        del: async () => {},
      }
      const onError = vi.fn<StoreErrorHandler<string>>()

      const wrapped = swallowStoreErrors(store, onError)
      controller.abort()

      // The cancellation propagates rather than degrading to a cache miss...
      await expect(
        wrapped.get('key', { signal: controller.signal }),
      ).rejects.toThrow()
      // ...and is not reported to the error handler as a store failure.
      expect(onError).not.toHaveBeenCalled()
    })
  })

  describe('clear', () => {
    it('swallows errors with "clear"', async () => {
      const err = new Error('clear boom')
      const store: TestStore = {
        get: async () => undefined,
        set: async () => {},
        del: async () => {},
        clear: async () => {
          throw err
        },
      }
      const onError = vi.fn<StoreErrorHandler<string>>()

      const wrapped = swallowStoreErrors(store, onError)

      expect(wrapped.clear).toBeTypeOf('function')
      await expect(wrapped.clear!()).resolves.toBeUndefined()
      expect(onError).toHaveBeenCalledWith(err, 'clear')
    })

    it('forwards a successful clear to the source store', async () => {
      const clear = vi.fn(async () => {})
      const store: TestStore = {
        get: async () => undefined,
        set: async () => {},
        del: async () => {},
        clear,
      }
      const onError = vi.fn<StoreErrorHandler<string>>()

      const wrapped = swallowStoreErrors(store, onError)

      await wrapped.clear!()
      expect(clear).toHaveBeenCalledOnce()
      expect(onError).not.toHaveBeenCalled()
    })
  })
})
