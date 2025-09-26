import {
  AuthorizeOptions,
  BrowserOAuthClient,
  OAuthSession,
} from '@atproto/oauth-client-browser'
import { ExpoOAuthClientInterface } from './expo-oauth-client-interface'
import { ExpoOAuthClientOptions } from './expo-oauth-client-options'

export class ExpoOAuthClient
  extends BrowserOAuthClient
  implements ExpoOAuthClientInterface
{
  constructor({
    clientMetadata,
    responseMode = 'fragment',
    ...options
  }: ExpoOAuthClientOptions) {
    super({ ...options, clientMetadata, responseMode })
  }

  override async signIn(
    input: string,
    options?: AuthorizeOptions,
  ): Promise<OAuthSession> {
    // Force popup mode
    return this.signInPopup(input, {
      ...options,
      display: options?.display ?? 'touch',
    })
  }
}
