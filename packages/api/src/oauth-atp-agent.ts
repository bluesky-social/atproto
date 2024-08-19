// Type only import allowing this dependency to no impact the bundle size
import type { OAuthAgent, TokenInfo } from '@atproto/oauth-client'

import { Agent } from './agent'

export class OAuthAtpAgent extends Agent {
  constructor(readonly oauthAgent: OAuthAgent) {
    super(oauthAgent)
  }

  clone(): OAuthAtpAgent {
    return this.copyInto(new OAuthAtpAgent(this.oauthAgent))
  }

  get did(): string {
    return this.oauthAgent.sub
  }

  async signOut() {
    await this.oauthAgent.signOut()
  }

  public async getTokenInfo(refresh?: boolean): Promise<TokenInfo> {
    return this.oauthAgent.getTokenInfo(refresh)
  }
}
