export const tableName = 'list'

export interface List {
  uri: string
  cid: string
  creator: string
  name: string
  purpose: string
  description: string | null
  descriptionFacets: string | null
  avatarCid: string | null
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: List }
