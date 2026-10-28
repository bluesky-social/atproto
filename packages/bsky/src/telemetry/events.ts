import {
  type Logger,
  type Meter,
  SeverityNumber,
  ValueType,
  diag,
  logs,
  metrics,
} from '@opentelemetry/api'
import type { NotificationsV2Algorithm } from '../config.js'
import type { app } from '../lexicons/index.js'
import { eventsLogger } from '../logger.js'
import { isAbortError, isTimeoutError } from './util.js'

const meter: Meter = metrics.getMeter('@atproto/bsky')
const logger: Logger = logs.getLogger('@atproto/bsky')

export type HydrationSource =
  'known_likers' | 'known_followers' | 'activity_subscriptions'

/** XRPC method that owns a hydration; set on `HydrateCtx` from the method's `$lxm`. */
export type HydrationXrpcEndpoint =
  | app.bsky.embed.getEmbedExternalView.$lxm
  | app.bsky.unspecced.getAtmosphereExploreTab.$lxm

/** Reported XRPC endpoint of an external hydration traversal. */
export type ExternalHydrationXrpcEndpoint = HydrationXrpcEndpoint | 'unknown'

/** Entry point that owns an external hydration traversal. */
export type ExternalHydrationRoot = 'uris' | 'refs' | 'dependencies'
/**
 * `partial` is a returned traversal that recovered from a best-effort
 * dependency failure; `capped` takes precedence over it.
 */
export type ExternalHydrationOutcome =
  'completed' | 'capped' | 'partial' | 'failed'

/** Bounded metric attributes of an external hydration traversal. */
type ExternalHydrationAttributes = {
  xrpcEndpoint: ExternalHydrationXrpcEndpoint
  root: ExternalHydrationRoot
  outcome: ExternalHydrationOutcome
}

/**
 * Generic record lookup work of one external hydration traversal, across the
 * root and all nested dependency batches. Excludes profile/label hydration
 * and backlink sample/count RPCs.
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
  /**
   * Refs inspected by the traversal's first dependency discovery. A traversal
   * whose root batch failed has none.
   */
  roots: number
  /** Roots available after takedown and owner moderation. */
  rootsResolved: number
  /**
   * Refs inspected by later dependency discoveries: records returned by
   * successful nested batches. Lookups lost to a failed batch or the pass cap
   * are excluded.
   */
  dependencies: number
  /** Dependencies available after takedown and owner moderation. */
  dependenciesResolved: number
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

  #externalHydrationLookups =
    meter.createHistogram<ExternalHydrationAttributes>(
      'hydration.external.record_lookups',
      {
        description:
          'Generic external record lookups scheduled per hydration traversal, including nested dependency batches',
        unit: '{lookup}',
        valueType: ValueType.INT,
        advice: {
          explicitBucketBoundaries: [
            0, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000,
          ],
        },
      },
    )

  #externalHydrationBatches =
    meter.createHistogram<ExternalHydrationAttributes>(
      'hydration.external.batches',
      {
        description:
          'Generic external record fetch batches per hydration traversal, one per nested pass',
        unit: '{batch}',
        valueType: ValueType.INT,
        // @NOTE Traversals are capped at `MAX_EXTERNAL_HYDRATION_PASSES` (8).
        advice: { explicitBucketBoundaries: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
      },
    )

  #externalHydrationDuration =
    meter.createHistogram<ExternalHydrationAttributes>(
      'hydration.external.duration',
      {
        description:
          'Wall time of an external hydration traversal, including nested dependency batches',
        unit: 'ms',
        valueType: ValueType.DOUBLE,
        advice: {
          explicitBucketBoundaries: [
            5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
          ],
        },
      },
    )

  #externalHydrationRecords = meter.createCounter<{
    xrpcEndpoint: ExternalHydrationXrpcEndpoint
    kind: 'root' | 'dependency'
    status: 'resolved' | 'unresolved'
  }>('hydration.external.records', {
    description:
      'Root and dependency records inspected by external hydration traversals, by availability after moderation',
    unit: '{record}',
    valueType: ValueType.INT,
  })

  #notificationGroupingDuration = meter.createHistogram<{
    algorithm: NotificationsV2Algorithm
  }>('notifications.grouped.duration', {
    description:
      'Compute time of each notification grouping algorithm invocation',
    unit: 'ms',
    valueType: ValueType.DOUBLE,
    advice: {
      explicitBucketBoundaries: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25, 50, 100],
    },
  })

  #notificationHydrationDuration = meter.createHistogram(
    'notifications.grouped.hydration.duration',
    {
      description: 'Wall time of the grouped notifications hydration phase',
      unit: 'ms',
      valueType: ValueType.DOUBLE,
      advice: {
        explicitBucketBoundaries: [
          1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000,
        ],
      },
    },
  )

  #groupedNotificationsDataplaneFetches = meter.createHistogram(
    'notifications.grouped.dataplane_fetches',
    {
      description:
        'Dataplane notification fetches per grouped notifications response',
      unit: '{fetch}',
      valueType: ValueType.INT,
      advice: {
        explicitBucketBoundaries: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      },
    },
  )

  #groupedNotificationsItemsFetched = meter.createHistogram(
    'notifications.grouped.items_fetched',
    {
      description:
        'Raw notifications fetched across all dataplane reads per grouped notifications response',
      unit: '{notification}',
      valueType: ValueType.INT,
      advice: {
        explicitBucketBoundaries: [
          50, 100, 150, 200, 300, 400, 500, 1000, 1500, 2000, 3000,
        ],
      },
    },
  )

  #groupedNotificationsItemsReturned = meter.createHistogram(
    'notifications.grouped.items_returned',
    {
      description:
        'Raw notifications represented by the final groups per grouped notifications response',
      unit: '{notification}',
      valueType: ValueType.INT,
      advice: {
        explicitBucketBoundaries: [
          50, 100, 150, 200, 300, 400, 500, 1000, 1500, 2000, 3000,
        ],
      },
    },
  )

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
    xrpcEndpoint,
    root,
    outcome,
    durationMs,
    recordLookups,
    batches,
    maxPass,
    roots,
    rootsResolved,
    dependencies,
    dependenciesResolved,
  }: ExternalHydrationWork &
    ExternalHydrationAttributes & { durationMs: number }) {
    this.#log('external_hydration_traversal', {
      xrpcEndpoint,
      root,
      outcome,
      durationMs,
      recordLookups,
      batches,
      maxPass,
      roots,
      rootsResolved,
      dependencies,
      dependenciesResolved,
    })
    try {
      const attributes = { xrpcEndpoint, root, outcome }
      this.#externalHydrationLookups.record(recordLookups, attributes)
      this.#externalHydrationBatches.record(batches, attributes)
      this.#externalHydrationDuration.record(durationMs, attributes)
      this.#externalHydrationRecords.add(rootsResolved, {
        xrpcEndpoint,
        kind: 'root',
        status: 'resolved',
      })
      this.#externalHydrationRecords.add(roots - rootsResolved, {
        xrpcEndpoint,
        kind: 'root',
        status: 'unresolved',
      })
      this.#externalHydrationRecords.add(dependenciesResolved, {
        xrpcEndpoint,
        kind: 'dependency',
        status: 'resolved',
      })
      this.#externalHydrationRecords.add(dependencies - dependenciesResolved, {
        xrpcEndpoint,
        kind: 'dependency',
        status: 'unresolved',
      })
    } catch (err) {
      diag.error('Failed to record external_hydration_traversal:', err)
    }
  }

  /** Reports compute time once per grouping invocation, excluding dataplane reads. */
  notificationGrouping({
    algorithm,
    durationMs,
  }: {
    algorithm: NotificationsV2Algorithm
    durationMs: number
  }) {
    try {
      this.#notificationGroupingDuration.record(durationMs, { algorithm })
    } catch (err) {
      diag.error('Failed to record notification_grouping:', err)
    }
  }

  /** Reports dataplane fetches, raw-item counts, and hydration time once per completed page. */
  groupedNotifications({
    itemsFetched,
    itemsReturned,
    dataplaneFetches,
    hydrationDurationMs,
  }: {
    itemsFetched: number
    itemsReturned: number
    dataplaneFetches: number
    hydrationDurationMs: number
  }) {
    try {
      this.#groupedNotificationsItemsFetched.record(itemsFetched)
      this.#groupedNotificationsItemsReturned.record(itemsReturned)
      this.#groupedNotificationsDataplaneFetches.record(dataplaneFetches)
      this.#notificationHydrationDuration.record(hydrationDurationMs)
    } catch (err) {
      diag.error('Failed to record grouped_notifications:', err)
    }
  }
}

export const events: EventReporter = new EventReporter()
