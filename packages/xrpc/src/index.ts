export * from './client'
export * from './fetch-handler'
export * from './types'
export * from './util'
export * from './xrpc-client'

/* eslint-disable import/no-deprecated */
import { Client } from './client'
/** @deprecated create a local {@link XrpcClient} instance instead */
const defaultInst = new Client()
export default defaultInst
/* eslint-enable import/no-deprecated */
