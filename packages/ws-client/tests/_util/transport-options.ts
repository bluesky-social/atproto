import type { TransportOptions } from '../../src/transport/transport.ts'

/**
 * The transport options a test doesn't care about, to spread ahead of the ones it
 * does: `createTransport({ ...transportOptionDefaults, url, dataMode, signal })`.
 *
 * `TransportOptions` deliberately requires every field — it is an internal
 * contract with one production call site, where a forgotten option should be a
 * type error rather than a silent default. Tests construct transports directly,
 * so they need the uninteresting fields filled in from somewhere; spreading a
 * constant keeps the literal itself checked against `TransportOptions`, which a
 * wrapper function would hide behind its own signature.
 *
 * Frozen so one test cannot perturb another's defaults. `dataMode` is absent on
 * purpose: it decides what a transport yields, so every site states it.
 */
export const transportOptionDefaults: Omit<
  TransportOptions,
  'url' | 'dataMode' | 'signal'
> = Object.freeze({
  heartbeat: undefined,
  idleTimeoutMs: undefined,
  highWaterMark: undefined,
  maxBufferedBytes: undefined,
  headers: undefined,
  protocols: undefined,
  onOpen: () => {},
  onClose: () => {},
})
