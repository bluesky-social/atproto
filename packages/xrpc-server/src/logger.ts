import { subsystemLogger } from '@atproto/common'

export const logger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('xrpc-server')

export default logger
