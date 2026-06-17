export * from './client.js'
export * from './fetch-handler.js'
export * from './types.js'
export * from './util.js'
export * from './xrpc-client.js'

import { Client } from './client.js'
/** @deprecated create a local {@link XrpcClient} instance instead */
const defaultInst = new Client()
export default defaultInst
