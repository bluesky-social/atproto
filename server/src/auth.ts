import { Request } from 'express'
import * as ucan from 'ucans'
import { auth } from '@adx/common'
import { ServerError } from './error.js'

type Check = (ucan: ucan.Chained) => Error | null

export const checkReq = async (
  req: Request,
  ...checks: Check[]
): Promise<ucan.Store> => {
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
  return ucan.Store.fromTokens([token.encoded()])
}
