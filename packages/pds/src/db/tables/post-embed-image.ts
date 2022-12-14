export const tableName = 'post_embed_image'

export interface PostEmbedImage {
  postUri: string
  position: number
  imageCid: string
  alt: string
}

export type PartialDB = {
  [tableName]: PostEmbedImage
}
