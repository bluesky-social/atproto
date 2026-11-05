import { type ZodTypeDef, z } from 'zod'
import { didSchema } from '@atproto/did'
import type { IdentifierString } from '@atproto/oauth-provider-api'
import { emailSchema } from './email.js'
import { handleSchema } from './handle.js'

export type { IdentifierString }
export const identifierSchema = z.union([
  emailSchema,
  didSchema,
  handleSchema,
]) satisfies z.ZodType<IdentifierString, ZodTypeDef, string>
