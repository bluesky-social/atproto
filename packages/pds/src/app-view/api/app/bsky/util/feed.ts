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
