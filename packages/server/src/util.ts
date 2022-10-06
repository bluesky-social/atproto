import { Request } from 'express'

export const readReqBytes = async (req: Request): Promise<Uint8Array> => {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []

    req.on('data', (chunk) => {
      chunks.push(chunk)
    })

    req.on('end', () => {
      resolve(new Uint8Array(Buffer.concat(chunks)))
    })
  })
}

export const parseBooleanParam = (
  param: unknown,
  defaultTrue = false,
): boolean => {
  if (defaultTrue) {
    if (param === 'false' || param === 'f') return false
    return true
  } else {
    if (param === 'true' || param === 't') return true
    return false
  }
}
