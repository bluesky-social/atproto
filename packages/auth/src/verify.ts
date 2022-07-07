import { writeCap } from './capabilities'
import { adxSemantics, parseAdxResource } from './semantics'
import * as ucans from './ucans'

export const verifyUcan = async (
  token: ucans.Ucan | string,
  opts: ucans.VerifyOptions,
): Promise<ucans.Ucan> => {
  const encoded = typeof token === 'string' ? token : ucans.encode(token)
  const res = await ucans.verify(encoded, {
    ...opts,
    semantics: opts.semantics || adxSemantics,
  })
  if (!res.ok) {
    if (res.error[0]) {
      throw res.error[0]
    } else {
      throw new Error('Could not find requested capability')
    }
  }
  return ucans.validate(encoded)
}

export const verifyAdxUcan = async (
  token: ucans.Ucan | string,
  audience: string,
  cap: ucans.Capability,
): Promise<ucans.Ucan> => {
  const adxResource = parseAdxResource(cap.with)
  if (adxResource === null) {
    throw new Error(`Expected a valid Adx resource: ${cap.with}`)
  }
  const repoDid = adxResource.did
  return verifyUcan(token, {
    audience,
    requiredCapabilities: [{ capability: cap, rootIssuer: repoDid }],
  })
}

export const verifyFullWritePermission = async (
  token: ucans.Ucan | string,
  audience: string,
  repoDid: string,
): Promise<ucans.Ucan> => {
  return verifyAdxUcan(token, audience, writeCap(repoDid))
}
