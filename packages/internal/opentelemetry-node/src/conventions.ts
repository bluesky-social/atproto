export * from '@opentelemetry/semantic-conventions'

// @NOTE atproto-specific attribute keys, kept alongside the upstream re-export
// so consumers have a single import site for all resource/span attribute
// constants.
export const ATTR_XRPC_METHOD = 'xrpc.method'
export const ATTR_XRPC_PROXIED = 'xrpc.proxied'
export const ATTR_XRPC_PROXY = 'xrpc.proxy'
