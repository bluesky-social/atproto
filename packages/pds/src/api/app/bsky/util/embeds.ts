import { Presented as PresentedImage } from '../../../../lexicon/types/app/bsky/embed/images'
import { Presented as PresentedExternal } from '../../../../lexicon/types/app/bsky/embed/external'
import { ImageUriBuilder } from '../../../../image/uri'
import { Kysely } from 'kysely'
import DatabaseSchema from '../../../../db/database-schema'

export type FeedEmbeds = {
  [uri: string]: PresentedImage | PresentedExternal
}

export const embedsForPosts = async (
  db: Kysely<DatabaseSchema>,
  imgUriBuilder: ImageUriBuilder,
  postUris: string[],
): Promise<FeedEmbeds> => {
  const imgPromise = db
    .selectFrom('post_embed_image')
    .selectAll()
    .where('postUri', 'in', postUris)
    .orderBy('postUri')
    .orderBy('position')
    .execute()
  const extPromise = db
    .selectFrom('post_embed_external')
    .selectAll()
    .where('postUri', 'in', postUris)
    .execute()
  const [images, externals] = await Promise.all([imgPromise, extPromise])
  const imgEmbeds = images.reduce((acc, cur) => {
    if (!acc[cur.postUri]) {
      acc[cur.postUri] = {
        $type: 'app.bsky.embed.images#presented',
        images: [],
      }
    }
    acc[cur.postUri].images.push({
      thumb: imgUriBuilder.getCommonSignedUri('feed_thumbnail', cur.imageCid),
      fullsize: imgUriBuilder.getCommonSignedUri('feed_fullsize', cur.imageCid),
      alt: cur.alt,
    })
    return acc
  }, {} as { [uri: string]: PresentedImage })
  return externals.reduce((acc, cur) => {
    if (!acc[cur.postUri]) {
      acc[cur.postUri] = {
        $type: 'app.bsky.embed.external#presented',
        external: {
          uri: cur.uri,
          title: cur.title,
          description: cur.description,
          thumb: cur.thumbCid
            ? imgUriBuilder.getCommonSignedUri('feed_thumbnail', cur.thumbCid)
            : undefined,
        },
      }
    }
    return acc
  }, imgEmbeds as FeedEmbeds)
}
