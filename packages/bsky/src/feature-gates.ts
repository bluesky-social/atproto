import {
  GrowthBookClient,
  type UserContext as GrowthBookUserContext,
} from '@growthbook/growthbook'
import { featureGatesLogger } from './logger'

export type Config = {
  apiUrl?: string
  apiKey?: string
}

type UserContext = Omit<GrowthBookUserContext, 'attributes'> & {
  attributes?: {
    did: string | null
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

  constructor(private config: Config) {}

  async start() {
    try {
      if (this.config.apiKey) {
        this.client = new GrowthBookClient({
          apiHost: this.config.apiUrl,
          clientKey: this.config.apiKey,
        })
        await this.client.init()
        this.ready = true
      }
    } catch (err) {
      featureGatesLogger.error({ err }, 'Failed to initialize GrowthBook')
      this.ready = false
    }
  }

  userContext({
    did,
  }: Exclude<Partial<UserContext['attributes']>, undefined>): UserContext {
    if (!did) return {}
    return { attributes: { did } }
  }

  check(gate: FeatureGateID, ctx: UserContext): boolean {
    if (!this.ready || !this.client) return false
    if (!ctx.attributes || !ctx.attributes.did) return false
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
