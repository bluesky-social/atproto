import { Agent as Undici6Agent } from 'undici_v6' // NodeJS 22
import { Agent as Undici7Agent } from 'undici_v7' // NodeJS 24
import { Agent as Undici8Agent } from 'undici_v8' // NodeJS 26

export type UndiciAgent = Undici6Agent | Undici7Agent | Undici8Agent

/**
 * The subset of undici's `Agent.Options` that is stable across the undici major
 * versions supported here.
 */
export type UndiciAgentOptions = {
  /** Milliseconds allowed for the connection phase (TCP + TLS). */
  connectTimeout?: number
}

/**
 * Builds an undici {@link UndiciAgent} from the same major version of undici as
 * the one embedded in the running NodeJS.
 *
 * @note Major versions of undici are not guaranteed to be backwards compatible,
 * so a dispatcher can only be passed to a `fetch()` backed by the same major
 * version. Since `globalThis.fetch` is backed by the undici NodeJS embeds, the
 * dispatcher must be built from that same major version, which is not
 * necessarily the version this package depends on.
 */
export function createUndiciAgent(options?: UndiciAgentOptions): UndiciAgent {
  const major = Number(process.versions.undici?.split('.')[0])

  // @NOTE We deliberately do not fall back to the most recent Agent for unknown
  // versions: a mismatched dispatcher interface would fail at runtime.
  switch (major) {
    case 6:
      return new Undici6Agent(options)
    case 7:
      return new Undici7Agent(options)
    case 8:
      return new Undici8Agent(options)
    default:
      throw new Error(
        `Unsupported undici version: ${process.versions.undici}. Expected NodeJS to embed undici 6, 7, or 8.`,
      )
  }
}

/**
 * Wraps the global fetch so that every request is issued through the given
 * undici dispatcher.
 */
export function dispatcherFetch(
  dispatcher: UndiciAgent,
): typeof globalThis.fetch {
  return (input, init) =>
    globalThis.fetch(input, {
      ...init,
      // @ts-ignore `dispatcher` is not part of the WHATWG `RequestInit`, but
      // undici (which backs `globalThis.fetch` in NodeJS) does honor it. The
      // dispatcher comes from `createUndiciAgent`, so its interface matches the
      // undici backing that fetch.
      dispatcher,
    })
}
