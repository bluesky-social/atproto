import { TimeCidKeyset } from '../../../../../db/pagination'
import { FeedRow } from '../../../../services/feed'

export enum FeedAlgorithm {
  ReverseChronological = 'reverse-chronological',
}

export class FeedKeyset extends TimeCidKeyset<FeedRow> {
  labelResult(result: FeedRow) {
    return { primary: result.sortAt, secondary: result.cid }
  }
}

// For users with sparse feeds, avoid scanning back further than two weeks
export const getFeedDateThreshold = (days = 14) => {
  const timelineDateThreshold = new Date()
  timelineDateThreshold.setDate(timelineDateThreshold.getDate() - days)
  return timelineDateThreshold.toISOString()
}
