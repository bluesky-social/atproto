import { type ZodTypeDef, z } from 'zod'
import { didSchema } from '@atproto/did'
import type { AtIdentifierString } from '@atproto/syntax'
import { type EmailString, emailSchema } from './email.js'
import { handleSchema } from './handle.js'

export type IdentifierString = AtIdentifierString | EmailString
export const identifierSchema = z.union([
  emailSchema,
  didSchema,
  handleSchema,
]) satisfies z.ZodType<IdentifierString, ZodTypeDef, string>
