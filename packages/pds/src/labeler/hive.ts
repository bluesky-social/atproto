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

// sexual: https://docs.thehive.ai/docs/sexual-content
// gore and violence: https://docs.thehive.ai/docs/class-descriptions-violence-gore
const labelForClass = {
  yes_sexual_activity: 'porn',
  animal_genitalia_and_human: 'porn', // for some reason not included in 'yes_sexual_activity'
  yes_male_nudity: 'nudity',
  yes_female_nudity: 'nudity',
  general_suggestive: 'sexual',
  very_bloody: 'gore',
  human_corpse: 'corpse',
  yes_self_harm: 'self-harm',
}

export const summarizeLabels = (classes: HiveRespClass[]): string[] => {
  const labels: string[] = []
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
