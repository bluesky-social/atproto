import { ForbiddenError } from '@atproto/xrpc-server'
import { ModSubject } from '../mod-service/subject'
import { ReasonType } from '../lexicon/types/com/atproto/moderation/defs'

export type BlockReportSetting = {
  reasonTypes?: string[]
  collections?: string[]
  account?: boolean
}

export const assertReportAllowed = (
  blockReportSetting: BlockReportSetting,
  subject: ModSubject,
  reasonType: ReasonType,
) => {
  if (blockReportSetting.reasonTypes?.includes(reasonType)) {
    throw new ForbiddenError(
      'Report with this reason is not accepted',
      'ReasonNotAccepted',
    )
  }

  if (
    subject.isRecord() &&
    blockReportSetting.collections?.some((collection) =>
      subject.recordPath?.startsWith(collection),
    )
  ) {
    throw new ForbiddenError(
      'Report on records from this collection is not accepted',
      'CollectionNotAccepted',
    )
  }

  if (subject.isRepo() && blockReportSetting.account) {
    throw new ForbiddenError(
      'Report on accounts is not accepted',
      'AccountNotAccepted',
    )
  }
}
