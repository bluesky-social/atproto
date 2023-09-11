import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import * as lex from '../lexicon/lexicons'
import {
  isRecord as isPost,
  Record as PostRecord,
} from '../lexicon/types/app/bsky/feed/post'
import {
  isRecord as isProfile,
  Record as ProfileRecord,
} from '../lexicon/types/app/bsky/actor/profile'
import {
  isRecord as isList,
  Record as ListRecord,
} from '../lexicon/types/app/bsky/graph/list'
import {
  isRecord as isGenerator,
  Record as GeneratorRecord,
} from '../lexicon/types/app/bsky/feed/generator'
import { isMain as isEmbedImage } from '../lexicon/types/app/bsky/embed/images'
import { isMain as isEmbedExternal } from '../lexicon/types/app/bsky/embed/external'
import { isMain as isEmbedRecordWithMedia } from '../lexicon/types/app/bsky/embed/recordWithMedia'

type RecordFields = {
  text: string[]
  imgs: CID[]
}

export const getFieldsFromRecord = (
  record: unknown,
  uri: AtUri,
): RecordFields => {
  if (isPost(record)) {
    return getFieldsFromPost(record)
  } else if (isProfile(record)) {
    return getFieldsFromProfile(record)
  } else if (isList(record)) {
    return getFieldsFromList(record)
  } else if (isGenerator(record)) {
    return getFieldsFromGenerator(record, uri)
  } else {
    return { text: [], imgs: [] }
  }
}

export const getFieldsFromPost = (record: PostRecord): RecordFields => {
  const text: string[] = []
  const imgs: CID[] = []
  text.push(record.text)
  const embeds = separateEmbeds(record.embed)
  for (const embed of embeds) {
    if (isEmbedImage(embed)) {
      for (const img of embed.images) {
        imgs.push(img.image.ref)
        text.push(img.alt)
      }
    } else if (isEmbedExternal(embed)) {
      if (embed.external.thumb) {
        imgs.push(embed.external.thumb.ref)
      }
      text.push(embed.external.title)
      text.push(embed.external.description)
    }
  }
  return { text, imgs }
}

export const getFieldsFromProfile = (record: ProfileRecord): RecordFields => {
  const text: string[] = []
  const imgs: CID[] = []
  if (record.displayName) {
    text.push(record.displayName)
  }
  if (record.description) {
    text.push(record.description)
  }
  if (record.avatar) {
    imgs.push(record.avatar.ref)
  }
  if (record.banner) {
    imgs.push(record.banner.ref)
  }
  return { text, imgs }
}

export const getFieldsFromList = (record: ListRecord): RecordFields => {
  const text: string[] = []
  const imgs: CID[] = []
  if (record.name) {
    text.push(record.name)
  }
  if (record.description) {
    text.push(record.description)
  }
  if (record.avatar) {
    imgs.push(record.avatar.ref)
  }
  return { text, imgs }
}

export const getFieldsFromGenerator = (
  record: GeneratorRecord,
  uri: AtUri,
): RecordFields => {
  const text: string[] = []
  const imgs: CID[] = []
  text.push(uri.rkey)
  if (record.displayName) {
    text.push(record.displayName)
  }
  if (record.description) {
    text.push(record.description)
  }
  if (record.avatar) {
    imgs.push(record.avatar.ref)
  }
  return { text, imgs }
}

export const dedupe = (strs: (string | undefined)[]): string[] => {
  const set = new Set<string>()
  for (const str of strs) {
    if (str !== undefined) {
      set.add(str)
    }
  }
  return [...set]
}

const separateEmbeds = (embed: PostRecord['embed']) => {
  if (!embed) {
    return []
  }
  if (isEmbedRecordWithMedia(embed)) {
    return [{ $type: lex.ids.AppBskyEmbedRecord, ...embed.record }, embed.media]
  }
  return [embed]
}
