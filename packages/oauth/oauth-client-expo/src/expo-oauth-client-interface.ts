import type {
  AuthorizeOptions,
  OAuthClient,
  OAuthSession,
} from '@atproto/oauth-client'

export interface ExpoOAuthClientInterface extends OAuthClient, Disposable {
  signIn(input: string, options?: AuthorizeOptions): Promise<OAuthSession>
  handleCallback(): Promise<null | OAuthSession>
}
