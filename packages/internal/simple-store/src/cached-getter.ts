import type { GetOptions, Key, SimpleStore, Value } from './simple-store.js'
import { type Awaitable, type ContextOptions, assert } from './util.js'

export type { GetOptions }
export type GetCachedOptions<C = void> = ContextOptions<C> & {
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
}

export type GetterOptions<C = void> = {
  context: C extends void ? undefined : C
  noCache: boolean
  signal?: AbortSignal
}

export type Getter<K extends Key, V extends Value, C = void> = (
  key: K,
  options: GetterOptions<C>,
  storedValue: undefined | V,
) => Awaitable<V>

export type CachedGetterOptions<K extends Key, V extends Value> = {
  isStale?: (key: K, value: V) => boolean | PromiseLike<boolean>
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
  readonly #pending = new Map<K, PendingItem<V>>()
  readonly #getter: Getter<K, V, C>
  readonly #store: SimpleStore<K, V>
  readonly #options: CachedGetterOptions<K, V> = {}

  constructor(
    getter: Getter<K, V, C>,
    store: SimpleStore<K, V>,
    options: CachedGetterOptions<K, V> = {},
  ) {
    this.#getter = getter
    this.#store = store
    this.#options = options
  }

  async get(
    key: C extends void ? K : never,
    options?: GetCachedOptions<C>,
  ): Promise<V>
  async get(
    key: C extends void ? never : K,
    options: GetCachedOptions<C>,
  ): Promise<V>
  async get(
    key: K,
    {
      signal,
      context,
      allowStale = false,
      noCache = false,
    } = {} as GetCachedOptions<C>,
  ): Promise<V> {
    signal?.throwIfAborted()

    const { isStale, deleteOnError } = this.#options

    const allowStored: (value: V) => Awaitable<boolean> = noCache
      ? returnFalse // Never allow stored values to be returned
      : allowStale || isStale == null
        ? returnTrue // Always allow stored values to be returned
        : async (value: V) => !(await isStale(key, value))

    // As long as concurrent requests are made for the same key, only one
    // request will be made to the getStored & getter functions at a time. This
    // works because there is no async operation between the while() loop and
    // the pending.set() call below. Because of the single threaded nature of
    // JavaScript, the pending item will be set before the next iteration of the
    // while loop of any concurrent request.
    let previousExecutionFlow: undefined | PendingItem<V>
    while ((previousExecutionFlow = this.#pending.get(key))) {
      try {
        // If a concurrent request is already in progress, wait for it to finish
        const { isFresh, value } = await previousExecutionFlow

        // Use the concurrent request's result if it is fresh
        if (isFresh) return value
        // Use the concurrent request's result if not fresh (loaded from the
        // store), and matches the conditions for using a stored value.
        if (await allowStored(value)) return value
      } catch {
        // Ignore errors from previous execution flows (they will have been
        // propagated by that flow).
      }

      // Break the loop if the signal was aborted
      signal?.throwIfAborted()
    }

    const currentExecutionFlow: PendingItem<V> = Promise.resolve()
      .then(async () => {
        signal?.throwIfAborted()

        const storedValue = await this.getStored(key, { signal })

        if (storedValue !== undefined && (await allowStored(storedValue))) {
          // Use the stored value as return value for the current execution
          // flow. Notify other concurrent execution flows (that should be
          // "awaiting" in the loop above until this promise resolves) that we
          // got a value, but that it came from the store (isFresh = false).

          // We don't throw if the signal is aborted because we do want to
          // return the stored value to allow concurrent execution flows to use
          // it. If we want to return a failed promise, we can
          // signal?.throwIfAborted before returning at the end of this
          // method.
          return { isFresh: false, value: storedValue }
        }

        // Don't call the getter function if the signal was aborted, because it
        // may be an expensive operation.
        signal?.throwIfAborted()

        return Promise.resolve()
          .then(async () => {
            const options = { signal, noCache, context } as GetterOptions<C>
            return this.#getter.call(null, key, options, storedValue)
          })
          .catch(async (err) => {
            if (storedValue !== undefined) {
              try {
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
            // The value is stored even if the signal was aborted.
            await this.setStored(key, value)
            return { isFresh: true, value }
          })
      })
      .finally(() => {
        assert(
          this.#pending.get(key) === currentExecutionFlow,
          `Pending item for key "${key}" was replaced before it finished.`,
        )
        this.#pending.delete(key)
      })

    // This should never happen. Indeed, there must not be any 'await'
    // statement between this and the loop iteration check meaning that
    // this.pending.get returned undefined. It is there to catch bugs that
    // would occur in future changes to the code.
    assert(
      !this.#pending.has(key),
      `Concurrent execution flow for key "${key}" should not exist.`,
    )

    this.#pending.set(key, currentExecutionFlow)

    const { value } = await currentExecutionFlow
    return value
  }

  // @NOTE We propagate errors from the store. If the use-case prefers to ignore
  // errors from the store, it should be handled in the store implementation
  // (eg. by returning `undefined` instead of throwing).

  // @NOTE We define the store methods here to allow for overriding them in
  // subclasses.

  async getStored(key: K, options?: GetOptions): Promise<V | undefined> {
    return this.#store.get(key, options)
  }

  async setStored(key: K, value: V): Promise<void> {
    await this.#store.set(key, value)
  }

  async delStored(key: K, _cause?: unknown): Promise<void> {
    await this.#store.del(key)
  }
}
