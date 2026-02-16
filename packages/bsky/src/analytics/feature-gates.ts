import {
  GrowthBookClient,
  type UserContext as GrowthBookUserContext,
} from '@growthbook/growthbook'
import type express from 'express'
import { analyticsLogger } from '../logger'
import { MetricsClient } from './metrics'
import { extractAnalyticsHeaders } from './request'
import { Events } from './types'

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

export type Config = {
  apiHost?: string
  clientKey?: string
}

export type FeatureGateID =
  | 'suggested_users:discover_agent:enable'
  | 'suggested_onboarding_users:discover_agent:enable'
  | 'threads:reply_ranking_exploration:enable'
  | 'search:filtering_exploration:enable'

/**
 * Pre-evaluated feature gates map, the result of `FeatureGates.checkGates()`
 */
export type CheckedFeatureGatesMap = Map<FeatureGateID, boolean>

export class FeatureGatesClient {
  ready = false
  client: GrowthBookClient | undefined = undefined
  refreshInterval: NodeJS.Timeout | undefined = undefined
  metrics: MetricsClient<Events>

  constructor(private config: Config) {
    this.metrics = new MetricsClient<Events>({
      trackingEndpoint: config.apiHost ? `${config.apiHost}/t` : undefined,
    })
  }

  async start() {
    if (!this.config.apiHost || !this.config.clientKey) {
      analyticsLogger.info(
        {},
        'feature gates not configured, skipping initialization',
      )
      return
    }

    try {
      this.client = new GrowthBookClient({
        apiHost: this.config.apiHost,
        clientKey: this.config.clientKey,
        onFeatureUsage: (feature, result, userContext) => {
          this.metrics.track(
            'feature:viewed',
            {
              featureId: feature,
              featureResultValue: result.value,
              experimentId: result.experiment?.key,
              variationId: result.experimentResult?.key,
            },
            growthBookContextToTrackingMetadata(userContext),
          )
        },
        trackingCallback: (experiment, result, userContext) => {
          this.metrics.track(
            'experiment:viewed',
            {
              experimentId: experiment.key,
              variationId: result.key,
            },
            growthBookContextToTrackingMetadata(userContext),
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
        analyticsLogger.error(
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
          analyticsLogger.error({ err }, 'Failed to refresh features')
        }
      }, REFETCH_INTERVAL)

      /* Ready or not, here we come */
      this.ready = true
    } catch (err) {
      analyticsLogger.error({ err }, 'Client initialization failed')
    }
  }

  destroy() {
    if (this.ready) {
      this.ready = false
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval)
      }
    }
  }

  // Creates an evaluator where gate checks will be made scoped to
  // the provided user context.
  scope(did: string | null, req: express.Request): FeatureGatesScopedEvaluator {
    const analyticsHeaders = extractAnalyticsHeaders(req)
    return new FeatureGatesScopedEvaluator(this, {
      did: did,
      sessionId: analyticsHeaders.sessionId,
      stableId: analyticsHeaders.stableId,
    })
  }

  /**
   * Prefer using {@link FeatureGatesScopedEvaluator.check} instead.
   */
  check(gate: FeatureGateID, ctx: UserContext): boolean {
    if (!this.ready || !this.client) return false
    return this.client.isOn(gate, ctx)
  }

  /**
   * Pre-evaluate multiple feature gates for a given user, returning a map of
   * gate ID to boolean result.
   * Prefer using {@link FeatureGatesScopedEvaluator.checkGates} instead.
   */
  checkGates(gates: FeatureGateID[], ctx: UserContext): CheckedFeatureGatesMap {
    return new Map(gates.map((g) => [g, this.check(g, ctx)]))
  }
}

type UserContextAttributes = {
  did?: string | null
  stableId?: string | null
  sessionId?: string | null
}

type UserContext = Omit<GrowthBookUserContext, 'attributes'> & {
  attributes?: UserContextAttributes
}

// Wraps feature gate evaluations
export class FeatureGatesScopedEvaluator {
  constructor(
    private client: FeatureGatesClient,
    private userContextAttributes: UserContextAttributes,
  ) {}

  check(gate: FeatureGateID): boolean {
    return this.client.check(gate, { attributes: this.userContextAttributes })
  }

  /**
   * Pre-evaluate multiple feature gates for a given user, returning a map of
   * gate ID to boolean result.
   */
  checkGates(gates: FeatureGateID[]): CheckedFeatureGatesMap {
    return new Map(gates.map((g) => [g, this.check(g)]))
  }
}

function growthBookContextToTrackingMetadata(userContext: UserContext) {
  return {
    did: userContext.attributes?.did,
    stableId: userContext.attributes?.stableId,
    sessionId: userContext.attributes?.sessionId,
  }
}
