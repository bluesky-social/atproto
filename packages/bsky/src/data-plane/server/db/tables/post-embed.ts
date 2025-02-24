export const imageTableName = 'post_embed_image'
export const externalTableName = 'post_embed_external'
export const recordTableName = 'post_embed_record'
export const videoTableName = 'post_embed_video'

export interface PostEmbedImage {
  postUri: string
  position: number
  imageCid: string
  alt: string
}

export interface PostEmbedExternal {
  postUri: string
  uri: string
  title: string
  description: string
  thumbCid: string | null
}

export interface PostEmbedRecord {
  postUri: string
  embedUri: string
  embedCid: string
}

export interface PostEmbedVideo {
  postUri: string
  videoCid: string
  alt: string | null
}

export type PartialDB = {
  [imageTableName]: PostEmbedImage
  [externalTableName]: PostEmbedExternal
  [recordTableName]: PostEmbedRecord
  [videoTableName]: PostEmbedVideo
}
