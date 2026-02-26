import type {
  AuthorizeOptions,
  OAuthClient,
  OAuthSession,
} from '@atproto/oauth-client'

export interface ExpoOAuthClientInterface extends OAuthClient, AsyncDisposable {
  signIn(input: string, options?: AuthorizeOptions): Promise<OAuthSession>
  handleCallback(): Promise<null | OAuthSession>
}
