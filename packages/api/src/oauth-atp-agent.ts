// Type only import allowing this dependency to no impact the bundle size
import type { OAuthSession, TokenInfo } from '@atproto/oauth-client'

import { Agent } from './agent'

export class OAuthAtpAgent extends Agent {
  constructor(readonly oauthSession: OAuthSession) {
    super(oauthSession)
  }

  clone(): OAuthAtpAgent {
    return this.copyInto(new OAuthAtpAgent(this.oauthSession))
  }

  get did(): string {
    return this.oauthSession.sub
  }

  async signOut() {
    await this.oauthSession.signOut()
  }

  public async getTokenInfo(refresh?: boolean): Promise<TokenInfo> {
    return this.oauthSession.getTokenInfo(refresh)
  }
}
