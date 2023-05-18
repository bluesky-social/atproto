import stream from 'stream'
import axios from 'axios'
import FormData from 'form-data'
import { Labeler } from './base'
import Database from '../db'
import { BlobStore } from '@atproto/repo'
import { keywordLabeling } from './util'
import { BackgroundQueue } from '../event-stream/background-queue'

const HIVE_ENDPOINT = 'https://api.thehive.ai/api/v2/task/sync'

export class HiveLabeler extends Labeler {
  hiveApiKey: string
  keywords: Record<string, string>

  constructor(opts: {
    db: Database
    blobstore: BlobStore
    backgroundQueue: BackgroundQueue
    labelerDid: string
    hiveApiKey: string
    keywords: Record<string, string>
  }) {
    const { db, blobstore, backgroundQueue, labelerDid, hiveApiKey, keywords } =
      opts
    super({ db, blobstore, backgroundQueue, labelerDid })
    this.hiveApiKey = hiveApiKey
    this.keywords = keywords
  }

  async labelText(text: string): Promise<string[]> {
    return keywordLabeling(this.keywords, text)
  }

  async labelImg(img: stream.Readable): Promise<string[]> {
    return labelBlob(img, this.hiveApiKey)
  }
}

export const labelBlob = async (
  blob: stream.Readable,
  hiveApiKey: string,
): Promise<string[]> => {
  const classes = await makeHiveReq(blob, hiveApiKey)
  return summarizeLabels(classes)
}

export const makeHiveReq = async (
  blob: stream.Readable,
  hiveApiKey: string,
): Promise<HiveRespClass[]> => {
  const form = new FormData()
  form.append('media', blob)
  const res = await axios.post(HIVE_ENDPOINT, form, {
    headers: {
      'Content-Type': 'multipart/form-data',
      authorization: `token ${hiveApiKey}`,
      accept: 'application/json',
    },
  })
  return respToClasses(res.data)
}

export const respToClasses = (res: HiveResp): HiveRespClass[] => {
  const classes: HiveRespClass[] = []
  for (const status of res.status) {
    for (const out of status.response.output) {
      for (const cls of out.classes) {
        classes.push(cls)
      }
    }
  }
  return classes
}

// Matches only one (or none) of: porn, sexual, nudity
//
// porn: sexual and nudity. including both explicit activity or full-frontal and suggestive/intent
// sexual: sexually suggestive, not explicit; may include some forms of nudity
// nudity: non-sexual nudity (eg, artistic, possibly some photographic)
//
// hive docs/definitions: https://docs.thehive.ai/docs/sexual-content
export const sexualLabels = (classes: HiveRespClass[]): string[] => {
  const scores = {}

  for (const cls of classes) {
    scores[cls.class] = cls.score
  }

  // first check if porn...
  for (const pornClass of [
    'yes_sexual_activity',
    'animal_genitalia_and_human',
    'yes_realistic_nsfw',
  ]) {
    if (scores[pornClass] >= 0.9) {
      return ['porn']
    }
  }
  if (scores['general_nsfw'] >= 0.9) {
    // special case for some anime examples
    if (scores['animated_animal_genitalia'] >= 0.5) {
      return ['porn']
    }
    // special case for some pornographic/explicit classic drawings
    if (scores['yes_undressed'] >= 0.9 && scores['yes_sexual_activity'] > 0.9) {
      return ['porn']
    }
  }

  // then check for sexual suggestive (which may include nudity)...
  for (const sexualClass of ['yes_sexual_intent', 'yes_sex_toy']) {
    if (scores[sexualClass] >= 0.9) {
      return ['sexual']
    }
  }
  if (scores['yes_undressed'] >= 0.9) {
    // special case for bondage examples
    if (scores['yes_sex_toy'] > 0.75) {
      return ['sexual']
    }
  }

  // then non-sexual nudity...
  for (const nudityClass of [
    'yes_male_nudity',
    'yes_female_nudity',
    'yes_undressed',
  ]) {
    if (scores[nudityClass] >= 0.9) {
      return ['nudity']
    }
  }

  // then finally flag remaining "underwear" images in to sexually suggestive
  // (after non-sexual content already labeled above)
  for (const nudityClass of ['yes_male_underwear', 'yes_female_underwear']) {
    if (scores[nudityClass] >= 0.9) {
      // TODO: retaining 'underwear' label for a short time to help understand
      // the impact of labeling all "underwear" as "sexual". This *will* be
      // pulling in somewhat non-sexual content in to "sexual" label.
      return ['sexual', 'underwear']
    }
  }

  return []
}

// gore and violence: https://docs.thehive.ai/docs/class-descriptions-violence-gore
const labelForClass = {
  very_bloody: 'gore',
  human_corpse: 'corpse',
  hanging: 'corpse',
  yes_self_harm: 'self-harm',
}

export const summarizeLabels = (classes: HiveRespClass[]): string[] => {
  const labels: string[] = sexualLabels(classes)
  for (const cls of classes) {
    if (labelForClass[cls.class] && cls.score >= 0.9) {
      labels.push(labelForClass[cls.class])
    }
  }
  return labels
}

type HiveResp = {
  status: HiveRespStatus[]
}

type HiveRespStatus = {
  response: {
    output: HiveRespOutput[]
  }
}

type HiveRespOutput = {
  time: number
  classes: HiveRespClass[]
}

type HiveRespClass = {
  class: string
  score: number
}
