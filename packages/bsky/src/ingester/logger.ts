import { subsystemLogger } from '@atproto/common'

const logger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:ingester')

export default logger
