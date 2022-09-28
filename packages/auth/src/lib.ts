import * as ucans from '@ucans/core'
import * as didSdk from '@adxp/did-sdk'
import { p256Plugin } from '@adxp/crypto'
import { PluginInjectedApi } from './ucans/plugins'

export const DID_KEY_PLUGINS = [p256Plugin]

export type AuthLibOptions = {
  plcUrl: string
  resolutionTimeout: number
  additionalDidMethods: Record<string, ucans.DidMethodPlugin>
  additionalDidKeys: [ucans.DidKeyPlugin]
}

export class AuthLib {
  didResolver: didSdk.DidResolver
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
      checkJwtAlg: (did, jwtAlg) => {
        return true
      },
      verifySignature: async (did, data, sig) => {
        const atpData = await resolver.ensureResolveDid(did)
        // @TODO make this right
        return true
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
  }
}

export default AuthLib
