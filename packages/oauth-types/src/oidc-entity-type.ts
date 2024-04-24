import { z } from 'zod'

export const oidcEntityTypeSchema = z.enum(['userinfo', 'id_token'])

export type OidcEntityType = z.infer<typeof oidcEntityTypeSchema>
