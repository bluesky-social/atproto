import { Request } from 'express'
import * as ucan from 'ucans'
import * as auth from '@adxp/auth'
import { ServerError } from './error.js'
import { SERVER_KEYPAIR } from './server-identity.js'

type Check = (ucan: ucan.Chained) => Error | null

export const checkReq = async (
  req: Request,
  ...checks: Check[]
): Promise<auth.AuthStore> => {
  const header = req.headers.authorization
  if (!header) {
    throw new ServerError(403, 'No UCAN found in message headers')
  }
  let decoded: ucan.Chained
  try {
    const stripped = header.replace('Bearer ', '')
    decoded = await ucan.Chained.fromToken(stripped)
  } catch (err) {
    throw new ServerError(
      403,
      `Could not parse a proper UCAN from req header: ${err}`,
    )
  }
  let token: ucan.Chained
  try {
    token = await auth.checkUcan(decoded, ...checks)
  } catch (err) {
    throw new ServerError(
      403,
      `Attached UCAN does not allow the requested operation: ${err}`,
    )
  }
  return auth.AuthStore.fromTokens(SERVER_KEYPAIR, [token.encoded()])
}
