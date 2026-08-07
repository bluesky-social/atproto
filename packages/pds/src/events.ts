import { type Meter, ValueType, diag, metrics } from '@opentelemetry/api'
import { type Logger, SeverityNumber, logs } from '@opentelemetry/api-logs'
import type { DidString } from '@atproto/syntax'
import type { com } from './lexicons.js'
import { eventsLogger } from './logger.js'

const meter: Meter = metrics.getMeter('@atproto/pds')
const logger: Logger = logs.getLogger('@atproto/pds')

/**
 * Central hub for reporting PDS business events. Each method reports a single
 * event to every relevant sink in one call:
 *
 *  1. a pino logger      → stdout/stderr (docker logs)
 *  2. an OTEL counter    → aggregated metric (low-cardinality dimensions only)
 *  3. the OTEL Logs SDK  → structured, trace-correlated log record (full detail)
 *
 * This keeps the three concerns in sync: there is exactly one call site per
 * event, and the counter / log / attribute definitions live together here
 * rather than being duplicated and drifting across handlers.
 *
 * @note High-cardinality attributes (e.g. `did`, `clientId`) are included in
 * the pino and OTEL log records but deliberately kept OUT of the counters,
 * whose attributes must stay low-cardinality to avoid a metric-series
 * explosion.
 *
 * @note The OTEL counters and log records are no-ops unless the corresponding
 * OTEL exporter is configured (see ./telemetry.ts), so calling these methods is
 * always safe and essentially free when telemetry is disabled. Because the OTEL
 * logger's `emit()` captures the active span context, log records are
 * trace-correlated too.
 */
class EventReporter {
  #accountCreatedCounter = meter.createCounter<{
    source: com.atproto.server.createAccount.$lxm | 'oauth'
    deactivated: boolean
  }>('account.created', {
    description: 'Number of accounts created on this PDS',
    valueType: ValueType.INT,
  })

  #sessionCreatedCounter = meter.createCounter<{
    source:
      | com.atproto.server.createAccount.$lxm
      | com.atproto.server.createSession.$lxm
      | 'oauth'
  }>('session.created', {
    description: 'Number of sessions created on this PDS',
    valueType: ValueType.INT,
  })

  #oauthAuthorizationCounter = meter.createCounter<{
    clientFirstParty: boolean
  }>('oauth.authorization', {
    description: 'Increased when an OAuth authorization is granted on this PDS',
    valueType: ValueType.INT,
  })

  /**
   * Fans a single event out to both the pino logger (stdout/stderr) and the
   * OTEL Logs SDK (structured record).
   *
   * @note this method should never throw
   */
  #log(
    eventName: string,
    attributes: Record<string, string | number | boolean | undefined>,
  ) {
    try {
      logger.emit({
        eventName,
        severityNumber: SeverityNumber.INFO,
        attributes,
      })
      eventsLogger.info({ eventName, ...attributes })
    } catch (err) {
      diag.error(`Failed to log event ${eventName}:`, err)
    }
  }

  accountCreated({
    source,
    did,
    invited,
    deactivated,
    clientId,
  }: {
    source: com.atproto.server.createAccount.$lxm | 'oauth'
    did: DidString
    invited: boolean
    deactivated: boolean
    clientId?: string
  }) {
    this.#log('account.created', {
      source,
      did,
      invited,
      deactivated,
      clientId,
    })
    this.#accountCreatedCounter.add(1, { source, deactivated })
  }

  signedIn({ did, clientId }: { did: DidString; clientId?: string }) {
    this.#log('account.signed-in', { did, clientId })
  }

  sessionCreated({
    source,
    did,
    clientId,
  }: {
    source:
      | 'oauth'
      | com.atproto.server.createAccount.$lxm
      | com.atproto.server.createSession.$lxm
    did: DidString
    clientId?: string
  }) {
    this.#log('session.created', { source, did, clientId })
    this.#sessionCreatedCounter.add(1, { source })
  }

  sessionRefreshed({
    source,
    did,
    clientId,
  }: {
    source: 'oauth' | com.atproto.server.refreshSession.$lxm
    did: DidString
    clientId?: string
  }) {
    this.#log('session.refreshed', { source, did, clientId })
  }

  oauthAuthorized({
    did,
    clientId,
    clientTrusted,
    clientFirstParty,
    clientConfidential,
  }: {
    did: DidString
    clientId: string
    clientTrusted: boolean
    clientFirstParty: boolean
    clientConfidential: boolean
  }) {
    this.#log('oauth.authorized', {
      did,
      clientId,
      clientTrusted,
      clientFirstParty,
      clientConfidential,
    })
    this.#oauthAuthorizationCounter.add(1, { clientFirstParty })
  }
}

export const events = new EventReporter()
