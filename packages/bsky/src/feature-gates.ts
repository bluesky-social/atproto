import { Statsig, StatsigUser } from 'statsig-node'
import { sha256Hex } from '@atproto/crypto'

export type Config = {
  apiKey?: string
  env?: 'development' | 'staging' | 'production' | string
}

export enum GateID {
  NewSuggestedFollowsByActor = 'new_sugg_foll_by_actor',
}

/**
 * @see https://docs.statsig.com/server/nodejsServerSDK
 */
export class FeatureGates {
  ready = false
  private statsig = Statsig
  ids = GateID

  constructor(private config: Config) {}

  async start() {
    try {
      if (this.config.apiKey) {
        // special handling for test env, see `ServerConfig`
        await this.statsig.initialize(this.config.apiKey, {
          localMode: this.config.env === 'test',
          environment: {
            tier: this.config.env || 'development',
          },
        })
        this.ready = true
      }
    } catch (_) {
      this.ready = false
    }
  }

  destroy() {
    if (this.ready) {
      this.ready = false
      this.statsig.shutdown()
    }
  }

  async user({ did }: { did: string }): Promise<StatsigUser> {
    const userID = await sha256Hex(did)
    return {
      userID,
    }
  }

  check(user: StatsigUser, gate: GateID) {
    if (!this.ready) return false
    return this.statsig.checkGateSync(user, gate)
  }
}
