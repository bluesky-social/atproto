import { Fetch } from '@atproto/fetch'
import {
  ClientConfig,
  OAuthAuthorizeOptions,
  OAuthClientBase,
} from '@atproto/oauth-client'
import { OAuthClientMetadata } from '@atproto/oauth-client-metadata'
import { CryptoSubtle } from './crypto-subtle'

export type BrowserOauthClientFactoryOptions = {
  clientMetadata: OAuthClientMetadata
  config?: ClientConfig
  fetch?: Fetch
}

const POPUP_KEY_PREFIX = '@@oauth-popup-callback:'

export abstract class OAuthBrowserClient extends OAuthClientBase {
  static create({
    clientMetadata,
    config,
    fetch = globalThis.fetch,
  }: BrowserOauthClientFactoryOptions) {
    // "fragment" is safer as it is not sent to the server
    const responseMode = config?.responseMode ?? 'fragment'

    return class BrowserOAuthClient extends super.create({
      clientMetadata,
      fetch,
      config: { ...config, responseMode },
      cryptoImplementation: new CryptoSubtle(),
      stateStore: {
        // TODO: Remove old (leftover) sessions
        get(key) {
          const item = localStorage.getItem(key)
          if (!item) return undefined
          return JSON.parse(item)
        },
        set(key, value) {
          localStorage.setItem(key, JSON.stringify(value))
        },
        del(key) {
          localStorage.removeItem(key)
        },
      },
      sessionStore: {} as any, // TODO (Mandatory)
      // didCache, // TODO (for perf)
      // handleCache, // TODO (for perf)
      // serverMetadataCache, // TODO (for perf)
      // dpopNonceCache, // TODO (for perf)
    }) {
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
        const state = `${POPUP_KEY_PREFIX}${Math.random()
          .toString(36)
          .slice(2)}`
        const options: OAuthAuthorizeOptions = {
          ...opts,
          state,
          display: 'popup',
        }

        return this.authorize(input, options).then((url) => {
          const popup = window.open(url, '_blank', 'width=600,height=600')

          return new Promise<BrowserOAuthClient>((resolve, reject) => {
            const cleanup = () => {
              clearInterval(interval)
              clearTimeout(timeout)
              localStorage.removeItem(state)
              popup?.close()
            }

            const timeout = setTimeout(() => {
              reject(new Error('Timeout'))
              cleanup()
            }, 5 * 60e3)

            const interval = setInterval(() => {
              const result = JSON.parse(
                localStorage.getItem(state) || 'null',
              ) as PromiseSettledResult<string> | null

              if (!result) return

              cleanup()

              if (result.status === 'fulfilled') {
                const sessionId = result.value
                super.restore(sessionId).then(resolve, (err) => {
                  reject(err)
                  super.revoke(sessionId)
                })
              } else {
                // TODO: Re-build a proper error object (from the same class
                // that was used to throw the error)
                reject(new Error(result.reason))
              }
            }, 500)
          })
        })
      }

      static async signInCallback(
        paramsString = responseMode === 'fragment'
          ? window.location.hash.slice(1)
          : window.location.search.slice(1),
      ) {
        const params = new URLSearchParams(paramsString)

        const result = await this.callback(params).catch((err) => {
          // TODO: Throw a proper error from parent class to actually detect
          // oauth authorization errors
          const state = typeof (err as any)?.state
          if (
            typeof state === 'string' &&
            state?.startsWith(POPUP_KEY_PREFIX)
          ) {
            localStorage.setItem(
              `${POPUP_KEY_PREFIX}${state}`,
              JSON.stringify(<PromiseRejectedResult>{
                status: 'rejected',
                reason: err,
              }),
            )

            // Process will be continued in signInPopup of parent window
            window.close()

            // In case the browser didn't allow the popup to close
            throw new Error('Login successful, please close the popup window.')
          }
          throw err
        })

        // If this was initiated in a popup, forward the result to the parent
        // window.
        if (result.state?.startsWith(POPUP_KEY_PREFIX)) {
          localStorage.setItem(
            `${POPUP_KEY_PREFIX}${result.state}`,
            JSON.stringify(<PromiseFulfilledResult<string>>{
              status: 'fulfilled',
              value: result.sessionId,
            }),
          )

          // Process will be continued in signInPopup of parent window
          window.close()

          // In case the browser didn't allow the popup to close
          throw new Error('Login successful, please close the popup window.')
        }

        return result
      }
    }
  }
}
