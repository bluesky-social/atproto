export const whatsHotViewTableName = 'algo_whats_hot_view'

export interface AlgoWhatsHotView {
  uri: string
  cid: string
  score: number
}

export type PartialDB = {
  [whatsHotViewTableName]: AlgoWhatsHotView
}
