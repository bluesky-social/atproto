import * as ucans from '@ucans/core'
import { didPlugins } from './plugins'

export * from '@ucans/core'

const injected = ucans.getPluginInjectedApi(didPlugins)

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
