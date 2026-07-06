import { subsystemLogger } from '@atproto/common'

export const s3Logger: ReturnType<typeof subsystemLogger> =
  subsystemLogger('aws:s3')
