import { GrowthBookClient } from '@growthbook/growthbook'
import { featureGatesLogger } from '../logger'
import { FeatureGate } from './gates'
import { MetricsClient } from './metrics'
import { CheckedFeatureGatesMap, RawUserContext } from './types'
import {
  extractParsedUserContextFromGrowthBookUserContext,
  parseRawUserContext,
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

export class FeatureGatesClient {
  ready = false
  client: GrowthBookClient | undefined = undefined
  refreshInterval: NodeJS.Timeout | undefined = undefined
  metrics: MetricsClient

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
          this.metrics.track(
            'feature:viewed',
            {
              featureId: feature,
              featureResultValue: result.value,
              experimentId: result.experiment?.key,
              variationId: result.experimentResult?.key,
            },
            parsedUserContextToTrackingMetadata(
              extractParsedUserContextFromGrowthBookUserContext(userContext),
            ),
          )
        },
        trackingCallback: (experiment, result, userContext) => {
          this.metrics.track(
            'experiment:viewed',
            {
              experimentId: experiment.key,
              variationId: result.key,
            },
            parsedUserContextToTrackingMetadata(
              extractParsedUserContextFromGrowthBookUserContext(userContext),
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
  checkGates(
    gates: FeatureGate[],
    rawUserContext: RawUserContext,
  ): CheckedFeatureGatesMap {
    const gb = this.client
    const attributes = parseRawUserContext(rawUserContext)

    /*
     * If the GB client isn't ready, or we don't have a deviceId, we won't be
     * able to target the user with any feature gates, so just return false.
     * The latter validation matches that of our event proxy, just FYI.
     */
    if (!gb || !this.ready || !attributes.deviceId)
      return new Map(gates.map((g) => [g, false]))

    return new Map(gates.map((g) => [g, gb.isOn(g, { attributes })]))
  }
}
