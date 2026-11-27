export * from '@atproto-labs/fetch'

export * from './dispatch.js'
export * from './lookup.js'
export * from './safe.js'
export {
  type UnicastFetchOptions,
  checkUnicastPolicy,
  createUnicastFetch,
  createUnicastLookup,
  unicastLookup,
} from './unicast.js'

export {
  /** @deprecated use {@link DispatcherFetchOptions} instead */
  type DispatcherFetchOptions as SafeDispatchFetchWrapOptions,
  /** @deprecated use {@link createDispatcherFetch} instead */
  createDispatcherFetch as safeDispatchFetchWrap,
} from './dispatch.js'
export {
  /** @deprecated use {@link SafeFetchOptions} instead */
  type SafeFetchOptions as SafeFetchWrapOptions,
  /** @deprecated use {@link createSafeFetch} instead */
  createSafeFetch as safeFetchWrap,
} from './safe.js'
export {
  /** @deprecated use {@link UnicastFetchOptions} instead */
  type UnicastFetchOptions as UnicastFetchWrapOptions,
  /** @deprecated use {@link createUnicastFetch} instead */
  createUnicastFetch as unicastFetchWrap,
  /** @deprecated use {@link createUnicastLookup} instead */
  createUnicastLookup as unicastLookupWrap,
} from './unicast.js'

export {
  isUnicastIpHostname,
  /** @deprecated use {@link isUnicastIpHostname} instead */
  isUnicastIpHostname as isUnicastIp,
} from './util.js'
