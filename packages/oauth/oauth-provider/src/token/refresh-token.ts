import { z } from 'zod'
import {
  REFRESH_TOKEN_BYTES_LENGTH,
  REFRESH_TOKEN_PREFIX,
} from '../constants.js'
import { randomHexId } from '../lib/util/crypto.js'

export const REFRESH_TOKEN_LENGTH =
  REFRESH_TOKEN_PREFIX.length + REFRESH_TOKEN_BYTES_LENGTH * 2 // hex encoding

export const refreshTokenSchema = z
  .string()
  .length(REFRESH_TOKEN_LENGTH)
  .refine(
    (v): v is `${typeof REFRESH_TOKEN_PREFIX}${string}` =>
      v.startsWith(REFRESH_TOKEN_PREFIX),
    {
      message: `Invalid refresh token format`,
    },
  )

export const isRefreshToken = (data: unknown): data is RefreshToken =>
  refreshTokenSchema.safeParse(data).success

export type RefreshToken = z.infer<typeof refreshTokenSchema>
export const generateRefreshToken = async (): Promise<RefreshToken> => {
  return `${REFRESH_TOKEN_PREFIX}${await randomHexId(
    REFRESH_TOKEN_BYTES_LENGTH,
  )}`
}
