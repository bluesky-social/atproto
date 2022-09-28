import * as ucans from '@ucans/core'
import { writeCap } from './adx-capabilities'
import { adxSemantics, parseAdxResource } from './adx-semantics'
import { PluginInjectedApi } from './plugins'

export const verifyUcan =
  (ucanApi: PluginInjectedApi) =>
  async (
    token: ucans.Ucan | string,
    opts: ucans.VerifyOptions,
  ): Promise<ucans.Ucan> => {
    const encoded = typeof token === 'string' ? token : ucans.encode(token)
    const res = await ucanApi.verify(encoded, {
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
    return ucanApi.validate(encoded)
  }

export const verifyAdxUcan =
  (ucanApi: PluginInjectedApi) =>
  async (
    token: ucans.Ucan | string,
    audience: string,
    cap: ucans.Capability,
  ): Promise<ucans.Ucan> => {
    const adxResource = parseAdxResource(cap.with)
    if (adxResource === null) {
      throw new Error(`Expected a valid Adx resource: ${cap.with}`)
    }
    const repoDid = adxResource.did
    return verifyUcan(ucanApi)(token, {
      audience,
      requiredCapabilities: [{ capability: cap, rootIssuer: repoDid }],
    })
  }

export const verifyFullWritePermission =
  (ucanApi: PluginInjectedApi) =>
  async (
    token: ucans.Ucan | string,
    audience: string,
    repoDid: string,
  ): Promise<ucans.Ucan> => {
    return verifyAdxUcan(ucanApi)(token, audience, writeCap(repoDid))
  }
