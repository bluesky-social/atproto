import * as ucans from '@ucans/core'
import { DidableKey, EcdsaKeypair, p256Plugin } from '@atproto/crypto'
import { PluginInjectedApi } from './plugins'
import { verifySignature, verifySignatureUtf8 } from './signatures'
import { verifyUcan, verifyAtpUcan, verifyFullWritePermission } from './verify'
import AuthStore from './auth-store'
import { DidResolver } from '@atproto/did-resolver'

export const DID_KEY_PLUGINS = [p256Plugin]

export type VerifierOpts = {
  didResolver: DidResolver
  plcUrl: string
  resolutionTimeout: number
  additionalDidMethods: Record<string, ucans.DidMethodPlugin>
  additionalDidKeys: [ucans.DidKeyPlugin]
}

export class Verifier {
  didResolver: DidResolver
  plugins: ucans.Plugins
  ucanApi: PluginInjectedApi

  constructor(opts: Partial<VerifierOpts> = {}) {
    const {
      additionalDidKeys = [],
      additionalDidMethods = {},
      plcUrl,
      resolutionTimeout,
    } = opts

    const resolver =
      opts.didResolver ??
      new DidResolver({
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

  loadAuthStore(
    keypair: DidableKey,
    tokens: string[],
    controlledDid?: string,
  ): AuthStore {
    return new AuthStore(this.ucanApi, keypair, tokens, controlledDid)
  }

  async createTempAuthStore(tokens: string[] = []): Promise<AuthStore> {
    const keypair = await EcdsaKeypair.create()
    return this.loadAuthStore(keypair, tokens)
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

  async verifyAtpUcan(
    token: ucans.Ucan | string,
    audience: string,
    cap: ucans.Capability,
  ): Promise<ucans.Ucan> {
    return verifyAtpUcan(this.ucanApi)(token, audience, cap)
  }

  async verifyFullWritePermission(
    token: ucans.Ucan | string,
    audience: string,
    repoDid: string,
  ): Promise<ucans.Ucan> {
    return verifyFullWritePermission(this.ucanApi)(token, audience, repoDid)
  }

  async validateUcan(
    encodedUcan: string,
    opts?: Partial<ucans.ValidateOptions>,
  ): Promise<ucans.Ucan> {
    return this.ucanApi.validate(encodedUcan, opts)
  }
}

export default Verifier
