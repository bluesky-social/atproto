import type {
  AuthorizeOptions,
  OAuthClient,
  OAuthSession,
} from '@atproto/oauth-client'

export interface ExpoOAuthClientInterface extends OAuthClient, Disposable {
  signIn(
    input: string,
    options?: Omit<AuthorizeOptions, 'display'>,
  ): Promise<OAuthSession>
}
