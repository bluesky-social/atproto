import { ReasonType } from '../lexicon/types/com/atproto/moderation/defs'

export const getTagForReport = (reasonType: ReasonType) => {
  return `report:${reasonType.replace('com.atproto.moderation.defs#reason', '').toLowerCase()}`
}
