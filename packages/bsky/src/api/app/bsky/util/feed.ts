import { TimeCidKeyset } from '../../../../db/pagination'
import { FeedRow } from '../../../../services/feed/types'

export enum FeedAlgorithm {
  ReverseChronological = 'reverse-chronological',
}

export class FeedKeyset extends TimeCidKeyset<FeedRow> {
  labelResult(result: FeedRow) {
    return { primary: result.sortAt, secondary: result.cid }
  }
}

// For users with sparse feeds, avoid scanning more than one week for a single page
export const getFeedDateThreshold = (from: string | undefined, days = 1) => {
  const timelineDateThreshold = from ? new Date(from) : new Date()
  timelineDateThreshold.setDate(timelineDateThreshold.getDate() - days)
  return timelineDateThreshold.toISOString()
}
