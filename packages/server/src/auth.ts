import { Request, Response } from 'express'
import * as auth from '@adxp/auth'
import { ServerError } from './error'
import * as util from './util'

export const checkReq = async (
  req: Request,
  res: Response,
  cap: auth.ucans.Capability,
): Promise<auth.AuthStore> => {
  const header = req.headers.authorization
  if (!header) {
    throw new ServerError(403, 'No UCAN found in message headers')
  }
  let token: auth.Ucan
  try {
    const stripped = header.replace('Bearer ', '')
    token = await auth.validateUcan(stripped)
  } catch (err) {
    throw new ServerError(
      403,
      `Could not parse a proper UCAN from req header: ${err}`,
    )
  }
  const serverKey = util.getKeypair(res)
  try {
    await auth.verifyAdxUcan(token, serverKey.did(), cap)
  } catch (err) {
    throw new ServerError(
      403,
      `Attached UCAN does not allow the requested operation: ${err}`,
    )
  }
  return auth.AuthStore.fromTokens(serverKey, [auth.encodeUcan(token)])
}

export const serverAuthStore = (res: Response) => {
  const serverKey = util.getKeypair(res)
  return auth.AuthStore.fromTokens(serverKey, [])
}
