import { z } from 'zod'

const oidcClaimsValueSchema = z.union([z.string(), z.number(), z.boolean()])

export const oidcClaimsPropertiesSchema = z.object({
  essential: z.boolean().optional(),
  value: oidcClaimsValueSchema.optional(),
  values: z.array(oidcClaimsValueSchema).optional(),
})

export type OidcClaimsProperties = z.infer<typeof oidcClaimsPropertiesSchema>
