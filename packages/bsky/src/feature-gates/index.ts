import { GrowthBookClient } from '@growthbook/growthbook'
import type express from 'express'
import { featureGatesLogger } from '../logger'
import { Gate, IGNORE_METRICS_FOR_GATES } from './gates'
import { MetricsClient } from './metrics'
import {
  CheckedFeatureGatesMap,
  ScopedFeatureGatesClient,
  UserContext,
} from './types'
import {
  extractUserContextFromGrowthbookUserContext,
  mergeUserContexts,
  normalizeUserContext,
  parsedUserContextToTrackingMetadata,
} from './utils'

/**
 * We want this to be sufficiently high that we don't time out under
 * normal conditions, but not so high that it takes too long to boot
 * the server.
 */
const FETCH_TIMEOUT = 3e3 // 3 seconds

/**
 * StatSig used to default to every 10s, but I think 1m is fine
 */
const REFETCH_INTERVAL = 60e3 // 1 minute

/**
 * These need to match what the client sends
 */
const ANALYTICS_HEADER_DEVICE_ID = 'X-Bsky-Device-Id'
const ANALYTICS_HEADER_SESSION_ID = 'X-Bsky-Session-Id'

export { type ScopedFeatureGatesClient } from './types'

export class FeatureGatesClient {
  private ready = false
  private client: GrowthBookClient | undefined = undefined
  private refreshInterval: NodeJS.Timeout | undefined = undefined
  private metrics: MetricsClient

  /**
   * Easy access to the `Gate` enum for consumers of this class, so they don't
   * need to import it separately.
   */
  Gate = Gate

  constructor(
    private config: {
      growthBookApiHost?: string
      growthBookClientKey?: string
      eventProxyTrackingEndpoint?: string
    },
  ) {
    this.metrics = new MetricsClient({
      trackingEndpoint: config.eventProxyTrackingEndpoint,
    })
  }

  async start() {
    if (!this.config.growthBookApiHost || !this.config.growthBookClientKey) {
      featureGatesLogger.info(
        {},
        'feature gates not configured, skipping initialization',
      )
      return
    }

    try {
      this.client = new GrowthBookClient({
        apiHost: this.config.growthBookApiHost,
        clientKey: this.config.growthBookClientKey,
        onFeatureUsage: (feature, result, userContext) => {
          if (IGNORE_METRICS_FOR_GATES.has(feature as Gate)) return

          this.metrics.track(
            'feature:viewed',
            {
              featureId: feature,
              featureResultValue: result.value,
              experimentId: result.experiment?.key,
              variationId: result.experimentResult?.key,
            },
            parsedUserContextToTrackingMetadata(
              extractUserContextFromGrowthbookUserContext(userContext),
            ),
          )
        },
        trackingCallback: (experiment, result, userContext) => {
          /**
           * Experiments are only fired in a feature gate has an Experiment
           * attached in Growthbook. Howerver, we want to be extra sure that a
           * misconfigured experiment doesn't result in a huge increase in events, so we
           * protect this here.
           */
          if (
            result.featureId &&
            IGNORE_METRICS_FOR_GATES.has(result.featureId as Gate)
          )
            return

          this.metrics.track(
            'experiment:viewed',
            {
              experimentId: experiment.key,
              variationId: result.key,
            },
            parsedUserContextToTrackingMetadata(
              extractUserContextFromGrowthbookUserContext(userContext),
            ),
          )
        },
      })

      const { source, error } = await this.client.init({
        timeout: FETCH_TIMEOUT,
      })

      /**
       * This does not necessarily mean that the client completely failed,
       * since it could just be that the request timed out. It may succeed
       * after the timeout, or later during refreshes.
       *
       * @see https://docs.growthbook.io/lib/node#error-handling
       */
      if (error) {
        featureGatesLogger.error(
          { err: error, source },
          'Client failed to initialize normally',
        )
      }

      /**
       * Set up periodic refresh of feature definitions
       *
       * @see https://docs.growthbook.io/lib/node#refreshing-features
       */
      this.refreshInterval = setInterval(async () => {
        try {
          await this.client?.refreshFeatures({
            timeout: FETCH_TIMEOUT,
          })
        } catch (err) {
          featureGatesLogger.error({ err }, 'Failed to refresh features')
        }
      }, REFETCH_INTERVAL)

      /* Ready or not, here we come */
      this.ready = true
    } catch (err) {
      featureGatesLogger.error({ err }, 'Client initialization failed')
    }
  }

  destroy() {
    if (this.ready) {
      this.ready = false
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval)
      }
    }
    this.metrics.stop()
  }

  /**
   * Evaluate multiple feature gates for a given user, returning a map of gate
   * ID to boolean result.
   */
  private checkGates(
    gates: Gate[],
    userContext: UserContext,
  ): CheckedFeatureGatesMap {
    const gb = this.client
    const attributes = normalizeUserContext(userContext)
    if (!gb || !this.ready) return new Map(gates.map((g) => [g, false]))
    return new Map(gates.map((g) => [g, gb.isOn(g, { attributes })]))
  }

  scope(scopedUserContext: UserContext): ScopedFeatureGatesClient {
    /*
     * Create initial deviceId and sessionId values for the scoped client, to
     * be used throughout this request lifecycle.
     */
    const base = normalizeUserContext(scopedUserContext)
    return {
      Gate: this.Gate,
      checkGates: (
        gates: Gate[],
        userContextOverrides?: Pick<UserContext, 'did'>,
      ) => {
        /*
         * Merge the base user context with any overrides provided at check time. This
         * allows us to set a base context for the request, but also override or add
         * properties for specific gate checks if needed.
         */
        const userContext = mergeUserContexts(base, userContextOverrides)
        return this.checkGates(gates, userContext)
      },
      checkGate: (gate: Gate, userContextOverrides?: UserContext) => {
        const gatesMap = this.checkGates([gate], userContextOverrides || {})
        return gatesMap.get(gate) || false
      },
    }
  }

  /**
   * Parse properties available in XRPC handlers to `UserContext`. The returned
   * proeprties are used as GrowthBook `attributes` as well as the metadata
   * payload for our analytics events. This ensures that the same user properties
   * are used for both feature gate targeting and analytics.
   */
  parseUserContextFromHandler({
    viewer,
    req,
  }: {
    /**
     * The user's DID
     */
    viewer: string | null
    /**
     * The express request object, used to extract analytics headers for the user context
     */
    req: express.Request
  }): UserContext {
    const deviceId = req.header(ANALYTICS_HEADER_DEVICE_ID)
    const sessionId = req.header(ANALYTICS_HEADER_SESSION_ID)

    return normalizeUserContext({
      did: viewer,
      deviceId,
      sessionId,
    })
  }
}
