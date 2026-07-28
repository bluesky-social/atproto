import { type Meter, ValueType, diag, metrics } from '@opentelemetry/api'
import { type Logger, SeverityNumber, logs } from '@opentelemetry/api-logs'
import type { Logger as PinoLogger } from 'pino'
import type { com } from './lexicons.js'
import { accountLogger, oauthLogger, sessionLogger } from './logger.js'

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
    clientTrusted: boolean
    clientFirstParty: boolean
    clientConfidential: boolean
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
    pino: PinoLogger,
    eventName: string,
    body: string,
    attributes: Record<string, string | number | boolean | undefined>,
  ) {
    try {
      pino.info(attributes, body)
      logger.emit({
        eventName,
        severityNumber: SeverityNumber.INFO,
        body,
        attributes,
      })
    } catch (err) {
      try {
        diag.error(`Failed to log event ${eventName}:`, err)
      } catch {
        // ignore
      }
    }
  }

  /**
   * A new account was created on this PDS, either through the XRPC
   * `createAccount` endpoint or the OAuth sign-up flow.
   */
  accountCreated(attributes: {
    source: com.atproto.server.createAccount.$lxm | 'oauth'
    did: string
    invited: boolean
    deactivated: boolean
    // if present, the user is signing up as part of an OAuth flow
    clientId?: string
  }) {
    this.#log(accountLogger, 'account.created', 'sign up', attributes)
    this.#accountCreatedCounter.add(1, {
      source: attributes.source,
      deactivated: attributes.deactivated,
    })
  }

  /**
   * A user signed in through the OAuth flow (without necessarily creating an
   * account).
   */
  signedIn(attributes: {
    did: string
    // if present, the user is signing in as part of an OAuth flow
    clientId?: string
  }) {
    this.#log(oauthLogger, 'account.signed-in', 'sign in', attributes)
  }

  /**
   * A new session (token) was created on this PDS.
   */
  sessionCreated(attributes: {
    source:
      | com.atproto.server.createAccount.$lxm
      | com.atproto.server.createSession.$lxm
      | 'oauth'
    did: string
    clientId?: string
  }) {
    this.#log(sessionLogger, 'session.created', 'token created', attributes)
    this.#sessionCreatedCounter.add(1, { source: attributes.source })
  }

  /**
   * An existing session (token) was refreshed on this PDS.
   */
  sessionRefreshed(attributes: {
    source: com.atproto.server.refreshSession.$lxm | 'oauth'
    did: string
    clientId?: string
  }) {
    this.#log(sessionLogger, 'session.refreshed', 'token refreshed', attributes)
  }

  /**
   * An OAuth authorization was granted on this PDS.
   */
  oauthAuthorized(attributes: {
    did: string
    clientId: string
    clientTrusted: boolean
    clientFirstParty: boolean
    clientConfidential: boolean
  }) {
    this.#log(oauthLogger, 'oauth.authorized', 'authorized', attributes)
    this.#oauthAuthorizationCounter.add(1, {
      clientTrusted: attributes.clientTrusted,
      clientFirstParty: attributes.clientFirstParty,
      clientConfidential: attributes.clientConfidential,
    })
  }
}

export const events = new EventReporter()
