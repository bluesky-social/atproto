import { z } from 'zod'

// scope       = scope-token *( SP scope-token )
// scope-token = 1*( %x21 / %x23-5B / %x5D-7E )
export const OAUTH_SCOPE_REGEXP =
  /^[\x21\x23-\x5B\x5D-\x7E]+(?: [\x21\x23-\x5B\x5D-\x7E]+)*$/

export const isOAuthScope = (input: string): boolean =>
  OAUTH_SCOPE_REGEXP.test(input)

/**
 * A (single) space separated list of non empty printable ASCII char string
 * (except backslash and double quote).
 *
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-11#section-1.4.1}
 */
export const oauthScopeSchema = z.string().refine(isOAuthScope, {
  message: 'Invalid OAuth scope',
})

export type OAuthScope = z.infer<typeof oauthScopeSchema>
