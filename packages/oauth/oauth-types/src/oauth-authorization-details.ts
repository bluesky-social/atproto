import { z } from 'zod'
import { dangerousUriSchema } from './uri.js'

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc9396#section-2 | RFC 9396, Section 2}
 */
export const oauthAuthorizationDetailSchema = z.object({
  type: z.string(),
  /**
   * An array of strings representing the location of the resource or RS. These
   * strings are typically URIs identifying the location of the RS.
   */
  locations: z.array(dangerousUriSchema).optional(),
  /**
   * An array of strings representing the kinds of actions to be taken at the
   * resource.
   */
  actions: z.array(z.string()).optional(),
  /**
   * An array of strings representing the kinds of data being requested from the
   * resource.
   */
  datatypes: z.array(z.string()).optional(),
  /**
   * A string identifier indicating a specific resource available at the API.
   */
  identifier: z.string().optional(),
  /**
   * An array of strings representing the types or levels of privilege being
   * requested at the resource.
   */
  privileges: z.array(z.string()).optional(),
})

export type OAuthAuthorizationDetail = z.infer<
  typeof oauthAuthorizationDetailSchema
>

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc9396#section-2 | RFC 9396, Section 2}
 */
export const oauthAuthorizationDetailsSchema = z.array(
  oauthAuthorizationDetailSchema,
)

export type OAuthAuthorizationDetails = z.infer<
  typeof oauthAuthorizationDetailsSchema
>
