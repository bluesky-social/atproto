import {
  Awaitable,
  GetOptions as GetStoredOptions,
  Key,
  SimpleStore,
  Value,
} from './simple-store.js'

export type { GetStoredOptions }
export type GetCachedOptions<C = void> = {
  signal?: AbortSignal

  /**
   * Do not use the cache to get the value. Always get a new value from the
   * getter function.
   *
   * @default false
   */
  noCache?: boolean

  /**
   * When getting a value from the cache, allow the value to be returned even if
   * it is stale.
   *
   * Has no effect if the `isStale` option was not provided to the CachedGetter.
   *
   * @default true // If the CachedGetter has an isStale option
   * @default false // If no isStale option was provided to the CachedGetter
   */
  allowStale?: boolean
} & (C extends void ? { context?: C } : { context: C })

export type Getter<K extends Key, V extends Value, C = void> = (
  key: K,
  options: GetCachedOptions<C>,
  storedValue: undefined | V,
) => Awaitable<V>

export type CachedGetterOptions<K extends Key, V extends Value> = {
  isStale?: (key: K, value: V) => boolean | PromiseLike<boolean>
  onStoreError?: (err: unknown, key: K, value: V) => void | PromiseLike<void>
  deleteOnError?: (
    err: unknown,
    key: K,
    value: V,
  ) => boolean | PromiseLike<boolean>
}

type PendingItem<V> = Promise<{ value: V; isFresh: boolean }>

const returnTrue = () => true
const returnFalse = () => false

/**
 * Wrapper utility that uses a store to speed up the retrieval of values from an
 * (expensive) getter function.
 */
export class CachedGetter<
  K extends Key = string,
  V extends Value = Value,
  C = void,
> {
  private pending = new Map<K, PendingItem<V>>()

  constructor(
    readonly getter: Getter<K, V, C>,
    readonly store: SimpleStore<K, V>,
    readonly options?: CachedGetterOptions<K, V>,
  ) {}

  async get(
    key: C extends void ? K : never,
    options?: GetCachedOptions<C>,
  ): Promise<V>
  async get(
    key: C extends void ? never : K,
    options: GetCachedOptions<C>,
  ): Promise<V>
  async get(key: K, options = {} as GetCachedOptions<C>): Promise<V> {
    options.signal?.throwIfAborted()

    const isStale = this.options?.isStale

    const allowStored: (value: V) => Awaitable<boolean> = options.noCache
      ? returnFalse // Never allow stored values to be returned
      : options.allowStale || isStale == null
        ? returnTrue // Always allow stored values to be returned
        : async (value: V) => !(await isStale(key, value))

    // As long as concurrent requests are made for the same key, only one
    // request will be made to the cache & getter function at a time. This works
    // because there is no async operation between the while() loop and the
    // pending.set() call. Because of the "single threaded" nature of
    // JavaScript, the pending item will be set before the next iteration of the
    // while loop.
    let previousExecutionFlow: undefined | PendingItem<V>
    while ((previousExecutionFlow = this.pending.get(key))) {
      try {
        const { isFresh, value } = await previousExecutionFlow

        if (isFresh) return value
        if (await allowStored(value)) return value
      } catch {
        // Ignore errors from previous execution flows (they will have been
        // propagated by that flow).
      }

      options.signal?.throwIfAborted()
    }

    const currentExecutionFlow: PendingItem<V> = Promise.resolve()
      .then(async () => {
        const storedValue = await this.getStored(key, options)
        if (storedValue !== undefined && (await allowStored(storedValue))) {
          // Use the stored value as return value for the current execution
          // flow. Notify other concurrent execution flows (that should be
          // "stuck" in the loop before until this promise resolves) that we got
          // a value, but that it came from the store (isFresh = false).
          return { isFresh: false, value: storedValue }
        }

        return Promise.resolve()
          .then(async () => (0, this.getter)(key, options, storedValue))
          .catch(async (err) => {
            if (storedValue !== undefined) {
              try {
                const deleteOnError = this.options?.deleteOnError
                if (await deleteOnError?.(err, key, storedValue)) {
                  await this.delStored(key, err)
                }
              } catch (error) {
                throw new AggregateError(
                  [err, error],
                  'Error while deleting stored value',
                )
              }
            }
            throw err
          })
          .then(async (value) => {
            // The value should be stored even is the signal was aborted.
            await this.setStored(key, value)
            return { isFresh: true, value }
          })
      })
      .finally(() => {
        this.pending.delete(key)
      })

    if (this.pending.has(key)) {
      // This should never happen. Indeed, there must not be any 'await'
      // statement between this and the loop iteration check meaning that
      // this.pending.get returned undefined. It is there to catch bugs that
      // would occur in future changes to the code.
      throw new Error('Concurrent request for the same key')
    }

    this.pending.set(key, currentExecutionFlow)

    const { value } = await currentExecutionFlow
    return value
  }

  async getStored(key: K, options?: GetStoredOptions): Promise<V | undefined> {
    try {
      return await this.store.get(key, options)
    } catch (err) {
      return undefined
    }
  }

  async setStored(key: K, value: V): Promise<void> {
    try {
      await this.store.set(key, value)
    } catch (err) {
      const onStoreError = this.options?.onStoreError
      await onStoreError?.(err, key, value)
    }
  }

  async delStored(key: K, _cause?: unknown): Promise<void> {
    await this.store.del(key)
  }
}
