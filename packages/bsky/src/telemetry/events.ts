import { type Meter, ValueType, diag, metrics } from '@opentelemetry/api'
import { type Logger, SeverityNumber, logs } from '@opentelemetry/api-logs'
import { eventsLogger } from '../logger.js'
import { isAbortError, isTimeoutError } from './util.js'

const meter: Meter = metrics.getMeter('@atproto/bsky')
const logger: Logger = logs.getLogger('@atproto/bsky')

export type HydrationSource =
  'known_likers' | 'known_followers' | 'activity_subscriptions'

/**
 * Central hub for reporting AppView events. Each method reports a
 * single event to every relevant sink in one call:
 *
 *  1. a pino logger      → stdout/stderr (docker logs)
 *  2. an OTEL counter    → aggregated metric (low-cardinality dimensions only)
 *  3. the OTEL Logs SDK  → structured, trace-correlated log record (full detail)
 *
 * This keeps the three concerns in sync: there is exactly one call site per
 * event, and the counter / log / attribute definitions live together here
 * rather than being duplicated and drifting across handlers.
 *
 * @note High-cardinality attributes (e.g. `did`, `uri`) belong in the pino and
 * OTEL log records but must stay OUT of the counters, whose attributes must
 * remain low-cardinality to avoid a metric-series explosion.
 *
 * @note The OTEL counters and log records are no-ops unless the corresponding
 * OTEL exporter is configured, so calling these methods is always safe and
 * essentially free when telemetry is disabled.
 */
class EventReporter {
  #hydrationFailedCounter = meter.createCounter<{
    source: HydrationSource
    reason: 'abort' | 'timeout' | 'error'
  }>('hydration_failed', {
    description:
      'Number of fail-open hydration steps that did not produce a result',
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
      // Emits an OTEL log for the event (goes to collector).
      logger.emit({
        eventName,
        severityNumber: SeverityNumber.INFO,
        attributes,
      })

      // Emits a Pino log for the event (goes to stdout).
      // NOTE: We'll probably migrate towards only using OTEL.
      eventsLogger.info({ eventName, ...attributes })
    } catch (err) {
      diag.error(`Failed to log event ${eventName}:`, err)
    }
  }

  hydrationFailed({ source, err }: { source: HydrationSource; err: unknown }) {
    const reason = isAbortError(err)
      ? 'abort'
      : isTimeoutError(err)
        ? 'timeout'
        : 'error'
    this.#log('hydration_failed', { source, reason })
    this.#hydrationFailedCounter.add(1, { source, reason })
  }
}

export const events: EventReporter = new EventReporter()
