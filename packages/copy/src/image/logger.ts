import { subsystemLogger } from '@atproto/common'

export const logger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('bsky:image')

export default logger
