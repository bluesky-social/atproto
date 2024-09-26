import { z } from 'zod'

/**
 * A space separated list of most non-control ASCII characters except backslash
 * and double quote.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-11#section-1.4.1}
 */
export const oauthScopeSchema = z
  .string()
  // scope       = scope-token *( SP scope-token )
  // scope-token = 1*( %x21 / %x23-5B / %x5D-7E )
  .regex(/^[\x21\x23-\x5B\x5D-\x7E]+(?: [\x21\x23-\x5B\x5D-\x7E]+)*$/)

export type OAuthScope = z.infer<typeof oauthScopeSchema>
