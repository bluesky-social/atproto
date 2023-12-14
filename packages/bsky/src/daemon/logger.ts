import { subsystemLogger } from '@atproto/common'

const logger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:daemon')

export default logger
