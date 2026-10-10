import { type Meter, ValueType, diag, metrics } from '@opentelemetry/api'
import { type Logger, SeverityNumber, logs } from '@opentelemetry/api-logs'
import { eventsLogger } from '../logger.js'
import { isAbortError, isTimeoutError } from './util.js'

const meter: Meter = metrics.getMeter('@atproto/bsky')
const logger: Logger = logs.getLogger('@atproto/bsky')

export type HydrationSource =
  'known_likers' | 'known_followers' | 'activity_subscriptions'

/** Entry point that owns an external hydration traversal. */
export type ExternalHydrationRoot = 'uris' | 'refs' | 'dependencies'
export type ExternalHydrationOutcome = 'completed' | 'capped' | 'failed'

/**
 * Generic record lookup work of one external hydration traversal, across the
 * root and all nested dependency batches. Excludes profile/label hydration,
 * backlink sample/count RPCs, and legacy Standard Site reads.
 */
export type ExternalHydrationWork = {
  /**
   * Accepted latest/exact lookup identities scheduled for fetching, after
   * filtering duplicates and seen keys. Unavailable results and lookups in a
   * failed batch count; lookups skipped at the pass cap do not.
   */
  recordLookups: number
  /** Nonempty batches that scheduled generic fetches; not a raw RPC count. */
  batches: number
  /** Deepest fetched batch, where the root batch is pass 1; 0 if none. */
  maxPass: number
}

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
  }>('hydration.failed', {
    description:
      'Number of fail-open hydration steps that did not produce a result',
    valueType: ValueType.INT,
  })

  #externalHydrationLookups = meter.createHistogram<{
    root: ExternalHydrationRoot
    outcome: ExternalHydrationOutcome
  }>('hydration.external.record_lookups', {
    description:
      'Generic external record lookups scheduled per hydration traversal, including nested dependency batches',
    unit: '{lookup}',
    valueType: ValueType.INT,
    advice: {
      explicitBucketBoundaries: [0, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000],
    },
  })

  #externalHydrationBatches = meter.createHistogram<{
    root: ExternalHydrationRoot
    outcome: ExternalHydrationOutcome
  }>('hydration.external.batches', {
    description:
      'Generic external record fetch batches per hydration traversal, one per nested pass',
    unit: '{batch}',
    valueType: ValueType.INT,
    // @NOTE Traversals are capped at `MAX_EXTERNAL_HYDRATION_PASSES` (8).
    advice: { explicitBucketBoundaries: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
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

  /**
   * Reports the totals of one top-level external hydration traversal. Numeric
   * totals are observations and log fields, never metric attributes.
   *
   * @note this method should never throw
   */
  externalHydrationTraversal({
    root,
    outcome,
    recordLookups,
    batches,
    maxPass,
  }: ExternalHydrationWork & {
    root: ExternalHydrationRoot
    outcome: ExternalHydrationOutcome
  }) {
    this.#log('external_hydration_traversal', {
      root,
      outcome,
      recordLookups,
      batches,
      maxPass,
    })
    try {
      this.#externalHydrationLookups.record(recordLookups, { root, outcome })
      this.#externalHydrationBatches.record(batches, { root, outcome })
    } catch (err) {
      diag.error('Failed to record external_hydration_traversal:', err)
    }
  }
}

export const events: EventReporter = new EventReporter()
