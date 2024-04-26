import { FetchError, OAuthClient } from '@atproto/oauth-client'
import { XRPCError } from '@atproto/xrpc'
import { SessionManager } from './session-manager'

export class OAuthSessionManager implements SessionManager {
  constructor(readonly client: OAuthClient) {}

  async fetchHandler(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.client.request(url, init)
    } catch (cause) {
      if (cause instanceof FetchError) {
        throw new XRPCError(
          cause.statusCode,
          undefined,
          cause.message,
          undefined,
          { cause },
        )
      }
      throw cause
    }
  }

  async getServiceUrl(): Promise<URL> {
    return new URL(this.client.serverMetadata.issuer)
  }

  async getDid(): Promise<string> {
    const { sub } = await this.client.getTokenSet()
    return sub
  }
}
