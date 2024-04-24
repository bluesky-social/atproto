import { z } from 'zod'

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc9396#section-2 | RFC 9396, Section 2}
 */
export const oauthAuthorizationDetailsSchema = z.array(
  z.object({
    type: z.string(),
    locations: z.array(z.string().url()).optional(),
    actions: z.array(z.string()).optional(),
    datatypes: z.array(z.string()).optional(),
    identifier: z.string().optional(),
    privileges: z.array(z.string()).optional(),
  }),
)

export type OAuthAuthorizationDetails = z.infer<
  typeof oauthAuthorizationDetailsSchema
>
