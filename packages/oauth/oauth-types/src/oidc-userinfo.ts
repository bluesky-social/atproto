import { z } from 'zod'

export const oidcUserinfoSchema = z.object({
  sub: z.string(),
  iss: z.url().optional(),
  aud: z.union([z.string(), z.array(z.string()).min(1)]).optional(),

  email: z.email().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  preferred_username: z.string().optional(),
  picture: z.url().optional(),
})

export type OidcUserinfo = z.infer<typeof oidcUserinfoSchema>
