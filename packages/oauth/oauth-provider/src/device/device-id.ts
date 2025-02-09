import { z } from 'zod'
import { DEVICE_ID_BYTES_LENGTH, DEVICE_ID_PREFIX } from '../constants.js'
import { randomHexId } from '../lib/util/crypto.js'

export const DEVICE_ID_LENGTH =
  DEVICE_ID_PREFIX.length + DEVICE_ID_BYTES_LENGTH * 2 // hex encoding

export const deviceIdSchema = z
  .string()
  .length(DEVICE_ID_LENGTH)
  .refine(
    (v): v is `${typeof DEVICE_ID_PREFIX}${string}` =>
      v.startsWith(DEVICE_ID_PREFIX),
    {
      message: `Invalid device ID format`,
    },
  )

export type DeviceId = z.infer<typeof deviceIdSchema>
export const generateDeviceId = async (): Promise<DeviceId> => {
  return `${DEVICE_ID_PREFIX}${await randomHexId(DEVICE_ID_BYTES_LENGTH)}`
}
