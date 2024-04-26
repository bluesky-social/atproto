export * from './client'
export * from './types'
export * from './xrpc-dispatcher'
export * from './xrpc-client'

import { Client } from './client'
const defaultInst = new Client()
export default defaultInst
