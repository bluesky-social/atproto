import { subsystemLogger } from '@atproto/common'

const logger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:indexer')

export default logger
