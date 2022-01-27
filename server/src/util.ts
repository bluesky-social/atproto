import { Request } from "express";

export const readReqBytes = async (req: Request): Promise<Uint8Array> => {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []

    req.on('data', (chunk) => {
      chunks.push(chunk)
    })

    req.on('end', () => {
      resolve(
        new Uint8Array(Buffer.concat(chunks))
      )
    })
  })
}
