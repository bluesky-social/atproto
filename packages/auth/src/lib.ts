import * as ucans from '@ucans/core'
import * as didSdk from '@adxp/did-sdk'
import { p256Plugin } from '@adxp/crypto'
import { PluginInjectedApi } from './ucans/plugins'
import { verifySignature, verifySignatureUtf8 } from './signatures'
import { verifyUcan, verifyAdxUcan, verifyFullWritePermission } from './verify'

export const DID_KEY_PLUGINS = [p256Plugin]

export type AuthLibOptions = {
  plcUrl: string
  resolutionTimeout: number
  additionalDidMethods: Record<string, ucans.DidMethodPlugin>
  additionalDidKeys: [ucans.DidKeyPlugin]
}

export class AuthLib {
  didResolver: didSdk.DidResolver
  plugins: ucans.Plugins
  ucanApi: PluginInjectedApi

  constructor(opts: Partial<AuthLibOptions> = {}) {
    const {
      additionalDidKeys = [],
      additionalDidMethods = {},
      plcUrl,
      resolutionTimeout,
    } = opts

    const resolver = new didSdk.DidResolver({
      plcUrl,
      timeout: resolutionTimeout,
    })

    // handles did:web & did:plc
    const methodPlugins: ucans.DidMethodPlugin = {
      checkJwtAlg: (_did, _jwtAlg) => {
        return true
      },
      verifySignature: async (did, data, sig) => {
        const atpData = await resolver.resolveAtpData(did)
        return this.verifySignature(atpData.signingKey, data, sig)
      },
    }

    const plugins = new ucans.Plugins(
      [...DID_KEY_PLUGINS, ...additionalDidKeys],
      {
        ...additionalDidMethods,
        plc: methodPlugins,
        web: methodPlugins,
      },
    )
    this.ucanApi = ucans.getPluginInjectedApi(plugins)
    this.plugins = plugins
  }

  async verifySignature(
    did: string,
    data: Uint8Array,
    sig: Uint8Array,
  ): Promise<boolean> {
    return verifySignature(this.plugins)(did, data, sig)
  }

  async verifySignatureUtf8(
    did: string,
    data: string,
    sig: string,
  ): Promise<boolean> {
    return verifySignatureUtf8(this.plugins)(did, data, sig)
  }

  async verifyUcan(
    token: ucans.Ucan | string,
    opts: ucans.VerifyOptions,
  ): Promise<ucans.Ucan> {
    return verifyUcan(this.ucanApi)(token, opts)
  }

  async verifyAdxUcan(
    token: ucans.Ucan | string,
    audience: string,
    cap: ucans.Capability,
  ): Promise<ucans.Ucan> {
    return verifyAdxUcan(this.ucanApi)(token, audience, cap)
  }

  async verifyFullWritePermission(
    token: ucans.Ucan | string,
    audience: string,
    repoDid: string,
  ): Promise<ucans.Ucan> {
    return verifyFullWritePermission(this.ucanApi)(token, audience, repoDid)
  }
}

export default AuthLib
