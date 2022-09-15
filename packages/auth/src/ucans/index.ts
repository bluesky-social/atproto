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
export const Builder = injected.Builder
export const Store = injected.Store
export const delegationChains = injected.delegationChains
