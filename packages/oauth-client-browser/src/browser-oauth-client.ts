import { Fetch } from '@atproto/fetch'
import {
  ClientConfig,
  OAuthAuthorizeOptions,
  oauthClientFactory,
} from '@atproto/oauth-client'
import { OAuthClientMetadata } from '@atproto/oauth-client-metadata'
import { CryptoSubtle } from './crypto-subtle'

export type BrowserOauthClientFactoryOptions = {
  clientMetadata: OAuthClientMetadata
  config?: ClientConfig
  fetch?: Fetch
}

export function browserOAuthClientFactory({
  clientMetadata,
  config,
  fetch,
}: BrowserOauthClientFactoryOptions) {
  const OAuthClient = oauthClientFactory({
    clientMetadata,
    config,
    crypto: new CryptoSubtle(),
    fetch,
    didCache: {} as any, // TODO !
    handleCache: {} as any, // TODO !
    serverMetadataCache: {} as any, // TODO !
    dpopNonceCache: {} as any, // TODO !
    stateStore: {} as any, // TODO !
    sessionStore: {} as any, // TODO !
  })

  return class BrowserOAuthClient extends OAuthClient {
    static async signIn(input: string, options?: OAuthAuthorizeOptions) {
      const url = await this.authorize(input, options)

      return new Promise<never>((resolve, reject) => {
        window.open(url)

        // Handle back-forward cache
        setTimeout(() => reject(new Error('User navigated back')), 5e3)
      })
    }

    static signInPopup(
      input: string,
      opts?: Omit<OAuthAuthorizeOptions, 'state' | 'display'>,
    ): Promise<BrowserOAuthClient> {
      const state = `oauth-callback:${Math.random().toString(36).slice(2)}`
      const options: OAuthAuthorizeOptions = {
        ...opts,
        state,
        display: 'popup',
      }

      return this.authorize(input, options).then((url) => {
        const popup = window.open(url, '_blank', 'width=600,height=600')

        return new Promise<BrowserOAuthClient>((resolve, reject) => {
          const cleanup = () => {
            popup?.close()
            clearInterval(interval)
            clearTimeout(timeout)
            localStorage.removeItem(state)
          }

          const timeout = setTimeout(() => {
            reject(new Error('Timeout'))
            cleanup()
          }, 5 * 60e3)

          const interval = setInterval(() => {
            const result = localStorage.getItem(state)
            if (result) {
              cleanup()

              if (result.startsWith('sessionId:')) {
                const sessionId = result.slice(10)
                super.restore(sessionId).then(resolve, (err) => {
                  reject(err)
                  super.revoke(sessionId)
                })
              } else {
                reject(new Error(result))
              }
            }
          }, 500)
        })
      })
    }

    static async callback() {
      const paramsString =
        config?.responseMode === 'fragment'
          ? window.location.hash.slice(1)
          : window.location.search.slice(1)

      const params = new URLSearchParams(paramsString)
      const result = await super.callback(params)

      // TODO: also forward errors (requires better error handling in super class)
      if (result.state?.startsWith('oauth-callback:')) {
        localStorage.setItem(
          `oauth-callback:${result.state}`,
          `sessionId:${result.sessionId}`,
        )

        // Process will be continued in signInPopup of parent window
        window.close()
        throw new Error('Login successful, please close the popup window.')
      }

      return result
    }
  }
}
