import Statsig, { StatsigUser } from 'statsig-node'
import { featureGatesLogger } from './logger'

export type Config = {
  apiKey?: string
  env?: 'development' | 'staging' | 'production' | string
}

export enum FeatureGateID {
  /**
   * Left here ensure this is interpreted as a string enum and therefore
   * appease TS
   */
  _ = '',
  ThreadsV2ReplyRankingExploration = 'threads_v2_reply_ranking_exploration',
  SearchFilteringExploration = 'search_filtering_exploration',
}

/**
 * Pre-evaluated feature gates map, the result of `FeatureGates.checkGates()`
 */
export type CheckedFeatureGatesMap = Map<FeatureGateID, boolean>

/**
 * @see https://docs.statsig.com/server/nodejsServerSDK
 */
export class FeatureGates {
  ready = false
  private statsig = Statsig
  ids = FeatureGateID

  constructor(private config: Config) {}

  async start() {
    try {
      if (this.config.apiKey) {
        /**
         * Special handling in test mode, see {@link ServerConfig}
         *
         * {@link https://docs.statsig.com/server/nodejsServerSDK#local-overrides}
         */
        await this.statsig.initialize(this.config.apiKey, {
          localMode: this.config.env === 'test',
          environment: {
            tier: this.config.env || 'development',
          },
        })
        this.ready = true
      }
    } catch (err) {
      featureGatesLogger.error({ err }, 'Failed to initialize StatSig')
      this.ready = false
    }
  }

  destroy() {
    if (this.ready) {
      this.ready = false
      this.statsig.shutdown()
    }
  }

  user({ did }: { did?: string }): StatsigUser | undefined {
    return did
      ? {
          userID: did,
        }
      : undefined
  }

  check(gate: FeatureGateID, user?: StatsigUser): boolean {
    if (!this.ready) return false
    if (!user) return false
    return this.statsig.checkGateSync(user, gate)
  }

  /**
   * Pre-evaluate multiple feature gates for a given user, returning a map of
   * gate ID to boolean result.
   */
  checkGates(
    gates: FeatureGateID[],
    user?: StatsigUser,
  ): CheckedFeatureGatesMap {
    return new Map(gates.map((g) => [g, this.check(g, user)]))
  }
}
