import { ReasonType } from '../lexicon/types/com/atproto/moderation/defs'

export const getTagForReport = (reasonType: ReasonType) => {
  const reasonWithoutPrefix = reasonType
    .replace('com.atproto.moderation.defs#reason', '')
    .replace('tools.ozone.report.defs#reason', '')

  const kebabCase = reasonWithoutPrefix
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()

  return `report:${kebabCase}`
}
