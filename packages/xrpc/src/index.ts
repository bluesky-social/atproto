export * from './client'
export * from './fetch-handler'
export * from './types'
export * from './xrpc-client'

import { Client } from './client'
const defaultInst = new Client()
export default defaultInst
