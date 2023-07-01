// @NOTE postgres-only
export const whatsHotViewTableName = 'algo_whats_hot_view'

export interface AlgoWhatsHotView {
  uri: string
  cid: string
  score: number
}

export const recentFeedItemsView = 'recent_feed_items_view'

export interface RecentFeedItemsView {
  uri: string
  cid: string
  type: 'post' | 'repost'
  postUri: string
  originatorDid: string
  sortAt: string
}

export type PartialDB = {
  [whatsHotViewTableName]: AlgoWhatsHotView
  [recentFeedItemsView]: RecentFeedItemsView
}
