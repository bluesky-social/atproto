import { z } from 'zod'
import { TOKEN_ID_BYTES_LENGTH, TOKEN_ID_PREFIX } from '../constants.js'
import { randomHexId } from '../lib/util/crypto.js'

export const TOKEN_ID_LENGTH =
  TOKEN_ID_PREFIX.length + TOKEN_ID_BYTES_LENGTH * 2 // hex encoding

export const tokenIdSchema = z
  .string()
  .length(TOKEN_ID_LENGTH)
  .refine(
    (v): v is `${typeof TOKEN_ID_PREFIX}${string}` =>
      v.startsWith(TOKEN_ID_PREFIX),
    {
      message: `Invalid token ID format`,
    },
  )

export type TokenId = z.infer<typeof tokenIdSchema>
export const generateTokenId = async (): Promise<TokenId> => {
  return `${TOKEN_ID_PREFIX}${await randomHexId(TOKEN_ID_BYTES_LENGTH)}`
}

export const isTokenId = (data: unknown): data is TokenId =>
  tokenIdSchema.safeParse(data).success
