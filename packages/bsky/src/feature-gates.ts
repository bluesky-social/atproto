import {
  GrowthBookClient,
  type UserContext as GrowthBookUserContext,
} from '@growthbook/growthbook'
import { featureGatesLogger } from './logger'

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

type UserContext = Omit<GrowthBookUserContext, 'attributes'> & {
  attributes?: {
    did?: string | null
  }
}

export enum FeatureGateID {
  /**
   * Left here ensure this is interpreted as a string enum and therefore
   * appease TS
   */
  _ = '',
  SuggestedUsersDiscoverAgentEnable = 'suggested_users:discover_agent:enable',
  ThreadsReplyRankingExplorationEnable = 'threads:reply_ranking_exploration:enable',
  SearchFilteringExplorationEnable = 'search:filtering_exploration:enable',
}

/**
 * Pre-evaluated feature gates map, the result of `FeatureGates.checkGates()`
 */
export type CheckedFeatureGatesMap = Map<FeatureGateID, boolean>

export class FeatureGates {
  ready = false
  client: GrowthBookClient | undefined = undefined
  ids = FeatureGateID
  refreshInterval: NodeJS.Timeout | undefined = undefined

  constructor(private config: Config) {}

  async start() {
    try {
      if (this.config.apiHost && this.config.clientKey) {
        this.client = new GrowthBookClient({
          apiHost: this.config.apiHost,
          clientKey: this.config.clientKey,
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
      } else {
        featureGatesLogger.error(
          'Missing required config for FeatureGates client',
        )
      }
    } catch (err) {
      featureGatesLogger.error({ err }, 'Client initialization failed')
      this.ready = false
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

  userContext({
    did,
  }: Exclude<UserContext['attributes'], undefined>): UserContext {
    return { attributes: { did: did ?? null } }
  }

  check(gate: FeatureGateID, ctx: UserContext): boolean {
    if (!this.ready || !this.client) return false
    return this.client.isOn(gate, ctx)
  }

  /**
   * Pre-evaluate multiple feature gates for a given user, returning a map of
   * gate ID to boolean result.
   */
  checkGates(gates: FeatureGateID[], ctx: UserContext): CheckedFeatureGatesMap {
    return new Map(gates.map((g) => [g, this.check(g, ctx)]))
  }
}
