import { z } from 'zod'
import { CODE_BYTES_LENGTH, CODE_PREFIX } from '../constants.js'
import { randomHexId } from '../lib/util/crypto.js'

export const CODE_LENGTH = CODE_PREFIX.length + CODE_BYTES_LENGTH * 2 // hex encoding

export const codeSchema = z
  .string()
  .length(CODE_LENGTH) // hex encoding
  .refine(
    (v): v is `${typeof CODE_PREFIX}${string}` => v.startsWith(CODE_PREFIX),
    {
      message: `Invalid code format`,
    },
  )

export const isCode = (data: unknown): data is Code =>
  codeSchema.safeParse(data).success

export type Code = z.infer<typeof codeSchema>
export const generateCode = async (): Promise<Code> => {
  return `${CODE_PREFIX}${await randomHexId(CODE_BYTES_LENGTH)}`
}
