export * from './client'
export * from './types'
export * from './xrpc-agent'
export * from './xrpc-client'
export * from './xrpc-fetch-agent'

import { Client } from './client'
const defaultInst = new Client()
export default defaultInst
