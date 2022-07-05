import * as ucans from '@ucans/core'
import p256Plugin from './p256/plugin.js'

export * from '@ucans/core'

const plugins = new ucans.Plugins([p256Plugin], {})

const injected = ucans.getPluginInjectedApi(plugins)

export const build = injected.build
export const sign = injected.sign
export const signWithKeypair = injected.signWithKeypair
export const validate = injected.validate
export const validateProofs = injected.validateProofs
export const verify = injected.verify
export const createBuilder = injected.createBuilder
export const storeFromTokens = injected.storeFromTokens
export const emptyStore = injected.emptyStore
export const delegationChains = injected.delegationChains
