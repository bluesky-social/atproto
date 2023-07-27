import { Headers } from '@atproto/xrpc'
import {
  ProfileViewBasic,
  ProfileView,
  ProfileViewDetailed,
} from '../../../../../lexicon/types/app/bsky/actor/defs'
import { Record as ProfileRecord } from '../../../../../lexicon/types/app/bsky/actor/profile'
import { Record as PostRecord } from '../../../../../lexicon/types/app/bsky/feed/post'
import { ids } from '../../../../../lexicon/lexicons'
import AppContext from '../../../../../context'
import { PostView } from '../../../../../lexicon/types/app/bsky/feed/defs'
import {
  Main as EmbedImages,
  isMain as isEmbedImages,
} from '../../../../../lexicon/types/app/bsky/embed/images'
import {
  Main as EmbedExternal,
  isMain as isEmbedExternal,
} from '../../../../../lexicon/types/app/bsky/embed/external'
import {
  Main as EmbedRecord,
  isMain as isEmbedRecord,
  isViewRecord,
} from '../../../../../lexicon/types/app/bsky/embed/record'
import {
  Main as EmbedRecordWithMedia,
  isMain as isEmbedRecordWithMedia,
} from '../../../../../lexicon/types/app/bsky/embed/recordWithMedia'
import { cborToLexRecord } from '@atproto/repo'
import { RecordDescript } from '../../../../../services/local'

export type ApiRes<T> = {
  headers: Headers
  data: T
}

export const getClock = (headers: Headers): number | null => {
  const clock = headers['atproto-clock']
  if (!clock) return null
  const parsed = parseInt(clock)
  return isNaN(parsed) ? null : parsed
}

export const getImageUrl = (did: string, cid: string): string => {
  return `https://image.url/${did}/${cid}`
}

export const formatLocalProfileViewBasic = async (
  ctx: AppContext,
  did: string,
): Promise<ProfileViewBasic | null> => {
  const res = await ctx.db.db
    .selectFrom('did_handle')
    .leftJoin('record', 'record.did', 'did_handle.did')
    .leftJoin('ipld_block', (join) =>
      join
        .onRef('record.did', '=', 'ipld_block.creator')
        .onRef('record.cid', '=', 'ipld_block.cid'),
    )
    .where('did_handle.did', '=', did)
    .where('record.collection', '=', ids.AppBskyActorProfile)
    .where('record.rkey', '=', 'self')
    .selectAll()
    .executeTakeFirst()
  if (!res) return null
  const record = res.content
    ? (cborToLexRecord(res.content) as ProfileRecord)
    : null
  return {
    did,
    handle: res.handle,
    displayName: record?.displayName,
    avatar: record?.avatar
      ? getImageUrl(did, record.avatar.ref.toString())
      : undefined,
  }
}

export const formatLocalPostView = async (
  ctx: AppContext,
  descript: RecordDescript<PostRecord>,
): Promise<PostView | null> => {
  const { uri, cid, record } = descript
  const author = await formatLocalProfileViewBasic(ctx, uri.hostname)
  if (!author) return null
  return {
    uri: uri.toString(),
    cid: cid.toString(),
    author,
    record,
    indexedAt: '', // @TODO fix
  }
}

export const formatPostEmbed = async (
  ctx: AppContext,
  did: string,
  post: PostRecord,
) => {
  const embed = post.embed
  if (!embed) return null
  if (isEmbedImages(embed) || isEmbedExternal(embed)) {
    return formatSimpleEmbed(did, embed)
  } else if (isEmbedRecord(embed)) {
    return formatRecordEmbed(ctx, did, embed)
  } else if (isEmbedRecordWithMedia(embed)) {
    return formatRecordWithMediaEmbed(ctx, did, embed)
  } else {
    return null
  }
}

export const formatSimpleEmbed = (
  did: string,
  embed: EmbedImages | EmbedExternal,
) => {
  if (isEmbedImages(embed)) {
    const images = embed.images.map((img) => ({
      thumb: getImageUrl(did, img.image.ref.toString()),
      fullsize: getImageUrl(did, img.image.ref.toString()),
      alt: img.alt,
    }))
    return {
      $type: 'app.bsky.embed.images#view',
      images,
    }
  } else {
    const { uri, title, description, thumb } = embed.external
    return {
      $type: 'app.bsky.embed.external#view',
      uri,
      title,
      description,
      thumb: thumb ? getImageUrl(did, thumb.ref.toString()) : undefined,
    }
  }
}

export const formatRecordEmbed = async (
  ctx: AppContext,
  did: string,
  embed: EmbedRecord,
) => {
  if (isViewRecord(embed.record)) {
    const res = await ctx.appviewAgent.api.app.bsky.feed.getPosts(
      {
        uris: [embed.record.uri],
      },
      await ctx.serviceAuthHeaders(did),
    )
  }
  // @TODO
  return {} as any
}

export const formatRecordWithMediaEmbed = async (
  ctx: AppContext,
  did: string,
  embed: EmbedRecordWithMedia,
) => {
  if (!isEmbedImages(embed.media) && !isEmbedExternal(embed.media)) {
    return null
  }
  const media = formatSimpleEmbed(did, embed.media)
  const record = await formatRecordEmbed(ctx, did, embed.record)
  return {
    $type: 'app.bsky.embed.recordWithMedia#view',
    record,
    media,
  }
}

export const updateProfileViewBasic = (
  view: ProfileViewBasic,
  record: ProfileRecord,
): ProfileViewBasic => {
  return {
    ...view,
    displayName: record.displayName,
    avatar: record.avatar
      ? getImageUrl(view.did, record.avatar.ref.toString())
      : undefined,
  }
}

export const updateProfileView = (
  view: ProfileView,
  record: ProfileRecord,
): ProfileView => {
  return {
    ...updateProfileViewBasic(view, record),
    description: record.description,
  }
}

export const updateProfileDetailed = (
  view: ProfileViewDetailed,
  record: ProfileRecord,
): ProfileViewDetailed => {
  // @TODO add banner
  return {
    ...updateProfileView(view, record),
    banner: record.banner
      ? getImageUrl(view.did, record.banner.ref.toString())
      : undefined,
  }
}
