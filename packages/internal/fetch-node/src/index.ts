export * from '@atproto-labs/fetch'

export * from './safe.js'
export * from './unicast.js'
export * from './util.js'

export {
  /** @deprecated use {@link isUnicastIpHostname} instead */
  isUnicastIpHostname as isUnicastIp,
} from './util.js'
