import type { DataMode } from '../../src/message-channel.ts'
import type { TransportOptions } from '../../src/transport/transport.ts'

/**
 * Fills in the transport options a test doesn't care about.
 *
 * `TransportOptions` deliberately requires every field — it is an internal
 * contract with one production call site, where a forgotten option should be a
 * type error rather than a silent default. Tests construct transports directly,
 * so they need the defaults spelled once here instead of at twenty call sites.
 */
export function transportOptions<M extends DataMode>(
  options: Pick<TransportOptions<M>, 'url' | 'dataMode' | 'signal'> &
    Partial<TransportOptions<M>>,
): TransportOptions<M> {
  return {
    heartbeat: undefined,
    idleTimeoutMs: undefined,
    highWaterMark: undefined,
    maxBufferedBytes: undefined,
    headers: undefined,
    protocols: undefined,
    onOpen: () => {},
    onClose: () => {},
    ...options,
  }
}
