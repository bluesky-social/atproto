import { Selectable } from 'kysely'
import { FeedGenerator } from '../../db/tables/feed-generator'

export type FeedGenInfo = Selectable<FeedGenerator> & {
  likeCount: number
  viewerLike: string | null
}

export type FeedGenInfoMap = { [uri: string]: FeedGenInfo }
