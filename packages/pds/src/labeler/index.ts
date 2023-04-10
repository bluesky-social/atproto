import stream from 'stream'
import * as lex from '../lexicon/lexicons'
import { Record as PostRecord } from '../lexicon/types/app/bsky/feed/post'
import { Record as ProfileRecord } from '../lexicon/types/app/bsky/actor/profile'
import { isMain as isEmbedImage } from '../lexicon/types/app/bsky/embed/images'
import { isMain as isEmbedExternal } from '../lexicon/types/app/bsky/embed/external'
import { isMain as isEmbedRecordWithMedia } from '../lexicon/types/app/bsky/embed/recordWithMedia'
import Database from '../db'
import { BlobStore, cborToLex } from '@atproto/repo'
import { CID } from 'multiformats/cid'

export abstract class Labeler {
  constructor(public db: Database, public blobstore: BlobStore) {}
  async labelRecord(uri: string): Promise<string[]> {
    // only label posts & profile
    if (
      !uri.includes('app.bsky.feed.post') &&
      !uri.includes('app.bsky.actor.profile')
    ) {
      return []
    }

    const found = await this.db.db
      .selectFrom('record')
      .innerJoin('ipld_block', (join) =>
        join
          .onRef('ipld_block.creator', '=', 'record.did')
          .onRef('ipld_block.cid', '=', 'record.cid'),
      )
      .select('content')
      .executeTakeFirst()
    if (!found) return []

    const record = cborToLex(found.content)
    const fields: string[] = []
    const imgs: CID[] = []
    if (isPost(record)) {
      const fields: string[] = []
      const imgs: CID[] = []
      fields.push(record.text)
      const embeds = separateEmbeds(record.embed)
      for (const embed of embeds) {
        if (isEmbedImage(embed)) {
          for (const img of embed.images) {
            imgs.push(img.image.ref)
            fields.push(img.alt)
          }
        } else if (isEmbedExternal(embed)) {
          if (embed.external.thumb) {
            imgs.push(embed.external.thumb.ref)
          }
          fields.push(embed.external.title)
          fields.push(embed.external.description)
        }
      }
    } else if (isProfile(record)) {
      const fields: string[] = []
      const imgs: CID[] = []
      if (record.displayName) {
        fields.push(record.displayName)
      }
      if (record.description) {
        fields.push(record.description)
      }
      if (record.avatar) {
        imgs.push(record.avatar.ref)
      }
      if (record.banner) {
        imgs.push(record.banner.ref)
      }
    } else {
      // no need to label anything else
      return []
    }

    const txtLabels = await this.labelText(fields.join(' '))
    const imgLabels = await Promise.all(
      imgs.map(async (cid) => {
        const stream = await this.blobstore.getStream(cid)
        return this.labelImg(stream)
      }),
    )
    return dedupe([...txtLabels, ...imgLabels.flat()])
  }

  abstract labelText(text: string): Promise<string[]>
  abstract labelImg(img: stream.Readable): Promise<string[]>
}

const dedupe = (str: string[]): string[] => {
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

function separateEmbeds(embed: PostRecord['embed']) {
  if (!embed) {
    return []
  }
  if (isEmbedRecordWithMedia(embed)) {
    return [{ $type: lex.ids.AppBskyEmbedRecord, ...embed.record }, embed.media]
  }
  return [embed]
}
