import { randomBytes } from 'node:crypto'

export async function randomBuffer(bytesLength = 16) {
  return new Promise<Buffer>((resolve, reject) => {
    randomBytes(bytesLength, (err, buf) => {
      if (err) return reject(err)
      resolve(buf)
    })
  })
}

export async function randomHexId(bytesLength = 16) {
  const buffer = await randomBuffer(bytesLength)
  return buffer.toString('hex')
}

// Basically all algorithms supported by "jose"'s jwtVerify().
// @TODO Is there a way to get this list from the runtime instead of hardcoding it?
export const VERIFY_ALGOS = [
  'RS256',
  'RS384',
  'RS512',

  'PS256',
  'PS384',
  'PS512',

  'ES256',
  'ES256K',
  'ES384',
  'ES512',
] as const
