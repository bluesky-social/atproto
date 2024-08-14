import { Agent } from '@atproto/api'

import { OAuthAgent } from './oauth-agent.js'

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

  public async refreshIfNeeded(): Promise<void> {
    await this.oauthAgent.refreshIfNeeded()
  }
}
