export const imageTableName = 'post_embed_image'
export const externalTableName = 'post_embed_external'
export const postTableName = 'post_embed_post'

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

export interface PostEmbedPost {
  postUri: string
  embedPostUri: string
  embedPostCid: string
}

export type PartialDB = {
  [imageTableName]: PostEmbedImage
  [externalTableName]: PostEmbedExternal
  [postTableName]: PostEmbedPost
}
