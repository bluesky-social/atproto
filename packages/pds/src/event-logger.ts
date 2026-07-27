import { SeverityNumber, logs } from '@opentelemetry/api-logs'

// @NOTE This module is the counterpart of ./meter.ts, but for the OpenTelemetry
// *Logs* signal. We deliberately do NOT ship every pino log line to the OTEL
// stack (see the PinoInstrumentation setup in ./telemetry.ts, where log sending
// is disabled). Instead, the specific business events we want to observe in the
// OTEL stack are emitted explicitly here, giving us full control over what gets
// shipped. These events are emitted *in addition to* the regular pino logs
// (which keep going to stdout/stderr) and the metrics counters (see ./meter.ts).
//
// When no OTEL Logs exporter is configured, `logs.getLogger()` returns a no-op
// logger whose `emit()` does nothing, so calling these functions is safe (and
// essentially free) regardless of telemetry configuration. Because `emit()`
// captures the active span context, these records are trace-correlated too.
const logger = logs.getLogger('@atproto/pds')

/**
 * Emitted whenever a new account is created on this PDS, through either the XRPC
 * `createAccount` endpoint or the OAuth sign-up flow. Mirrors the
 * `account.created` counter in ./meter.ts.
 */
export function logAccountCreated({
  source,
  did,
  invited,
  deactivated,
  clientId,
}: {
  source: 'com.atproto.server.createAccount' | 'oauth'
  did: string
  invited: boolean
  deactivated: boolean
  clientId?: string
}) {
  logger.emit({
    eventName: 'account.created',
    severityNumber: SeverityNumber.INFO,
    attributes: { source, did, invited, deactivated, clientId },
  })
}

/**
 * Emitted whenever a user signs in through the OAuth flow (without necessarily
 * creating an account).
 */
export function logSignedIn({
  did,
  clientId,
}: {
  did: string
  clientId?: string
}) {
  logger.emit({
    eventName: 'account.signed-in',
    severityNumber: SeverityNumber.INFO,
    attributes: { did, clientId },
  })
}

/**
 * Emitted whenever a new session (token) is created on this PDS. Mirrors the
 * `session.created` counter in ./meter.ts.
 */
export function logSessionCreated({
  source,
  did,
  clientId,
}: {
  source: string
  did: string
  clientId?: string
}) {
  logger.emit({
    eventName: 'session.created',
    severityNumber: SeverityNumber.INFO,
    attributes: { source, did, clientId },
  })
}

/**
 * Emitted whenever a session (token) is refreshed on this PDS.
 */
export function logSessionRefreshed({
  source,
  did,
  clientId,
}: {
  source: string
  did: string
  clientId?: string
}) {
  logger.emit({
    eventName: 'session.refreshed',
    severityNumber: SeverityNumber.INFO,
    attributes: { source, did, clientId },
  })
}

/**
 * Emitted whenever an OAuth authorization is granted on this PDS. Mirrors the
 * `oauth.authorization` counter in ./meter.ts.
 */
export function logOauthAuthorized({
  did,
  clientId,
}: {
  did: string
  clientId: string
}) {
  logger.emit({
    eventName: 'oauth.authorized',
    severityNumber: SeverityNumber.INFO,
    attributes: { did, clientId },
  })
}
