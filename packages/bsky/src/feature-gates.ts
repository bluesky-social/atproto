import { GrowthBookClient } from '@growthbook/growthbook'
import { featureGatesLogger } from './logger'

export type Config = {
  apiUrl?: string
  apiKey?: string
}

type Attrs = {
  did?: string
}

type Context = {
  attributes: Attrs
}

export enum FeatureGateID {
  /**
   * Left here ensure this is interpreted as a string enum and therefore
   * appease TS
   */
  _ = '',
  SuggestedUsersFromDiscover = 'disc_onboarding_follow_suggest',
  ThreadsV2ReplyRankingExploration = 'threads_v2_reply_ranking_exploration',
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
        this.ready = true
      }
    } catch (err) {
      featureGatesLogger.error({ err }, 'Failed to initialize GrowthBook')
      this.ready = false
    }
  }

  contextForDid(did: string): Context {
    return { attributes: { did: did } }
  }

  check(gate: FeatureGateID, ctx: Context): boolean {
    if (!this.ready || !this.client) return false
    if (!ctx.attributes || !ctx.attributes.did) return false

    // TODO: migrate from StatSig to GrowthBook
    if (gate === FeatureGateID.ThreadsV2ReplyRankingExploration) return false

    return this.client.isOn(gate, ctx)
  }

  /**
   * Pre-evaluate multiple feature gates for a given user, returning a map of
   * gate ID to boolean result.
   */
  checkGates(gates: FeatureGateID[], ctx: Context): CheckedFeatureGatesMap {
    return new Map(gates.map((g) => [g, this.check(g, ctx)]))
  }
}
