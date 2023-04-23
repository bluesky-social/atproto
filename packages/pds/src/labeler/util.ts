import { CID } from 'multiformats/cid'
import * as lex from '../lexicon/lexicons'
import { Record as PostRecord } from '../lexicon/types/app/bsky/feed/post'
import { Record as ProfileRecord } from '../lexicon/types/app/bsky/actor/profile'
import { isMain as isEmbedImage } from '../lexicon/types/app/bsky/embed/images'
import { isMain as isEmbedExternal } from '../lexicon/types/app/bsky/embed/external'
import { isMain as isEmbedRecordWithMedia } from '../lexicon/types/app/bsky/embed/recordWithMedia'

type RecordFields = {
  text: string[]
  imgs: CID[]
}

export const getFieldsFromRecord = (record: unknown): RecordFields => {
  if (isPost(record)) {
    return getFieldsFromPost(record)
    // @TODO add back in profile labeling
    // } else if (isProfile(record)) {
    // return getFieldsFromProfile(record)
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

export const dedupe = (str: string[]): string[] => {
  const set = new Set(str)
  return [...set]
}

export const isPost = (obj: unknown): obj is PostRecord => {
  return isRecordType(obj, 'app.bsky.feed.post')
}

export const isProfile = (obj: unknown): obj is ProfileRecord => {
  return isRecordType(obj, 'app.bsky.actor.profile')
}

export const isRecordType = (obj: unknown, lexId: string): boolean => {
  try {
    lex.lexicons.assertValidRecord(lexId, obj)
    return true
  } catch {
    return false
  }
}

export const keywordLabeling = (
  keywords: Record<string, string>,
  text: string,
): string[] => {
  const lowerText = text.toLowerCase()
  const labels: string[] = []
  for (const word of Object.keys(keywords)) {
    if (lowerText.includes(word)) {
      labels.push(keywords[word])
    }
  }
  return labels
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
