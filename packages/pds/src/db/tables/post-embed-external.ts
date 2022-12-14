export const tableName = 'post_embed_external'

export interface PostEmbedExternal {
  postUri: string
  uri: string
  title: string
  description: string
  thumbCid: string | null
}

export type PartialDB = {
  [tableName]: PostEmbedExternal
}
