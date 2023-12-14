export const tableName = 'feed_item'

export interface FeedItem {
  uri: string
  cid: string
  type: 'post' | 'repost'
  postUri: string
  originatorDid: string
  sortAt: string
}

export type PartialDB = { [tableName]: FeedItem }
