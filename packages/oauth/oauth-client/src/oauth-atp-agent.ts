import { Agent } from '@atproto/api'
import { XRPCError } from '@atproto/xrpc'
import { FetchError, FetchResponseError } from '@atproto-labs/fetch'

import { OAuthAgent } from './oauth-agent.js'

export class OAuthAtpAgent extends Agent {
  constructor(readonly oauthAgent: OAuthAgent) {
    super(async (url, init) => {
      try {
        return await this.oauthAgent.request(url, init)
      } catch (cause) {
        if (cause instanceof FetchError) {
          const { statusCode, message } = cause
          throw new XRPCError(statusCode, undefined, message, undefined, {
            cause,
          })
        }

        if (cause instanceof FetchResponseError) {
          const { statusCode, message, response } = cause
          const headers = Object.fromEntries(response.headers.entries())
          throw new XRPCError(statusCode, undefined, message, headers, {
            cause,
          })
        }

        throw cause
      }
    })
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
