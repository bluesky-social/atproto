import { z } from 'zod'

export const oauthResponseModeSchema = z.enum([
  'query',
  'fragment',
  'form_post',
])

export type OAuthResponseMode = z.infer<typeof oauthResponseModeSchema>
