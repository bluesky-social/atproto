import stream from 'stream'
import axios from 'axios'
import FormData from 'form-data'
import { BaseLabeler } from './base'
import Database from '../db'
import { BlobStore } from '@atproto/repo'

const HIVE_ENDPOINT = 'https://api.thehive.ai/api/v2/task/sync'

export class HiveLabeler extends BaseLabeler {
  hiveEndpoint: string
  hiveApiKey: string
  keywords: Record<string, string>

  constructor(opts: {
    db: Database
    blobstore: BlobStore
    hiveApiKey: string
    keywords: Record<string, string>
  }) {
    super(opts.db, opts.blobstore)
    this.hiveApiKey = opts.hiveApiKey
    this.keywords = opts.keywords
  }

  async labelText(text: string): Promise<string[]> {
    const labels: string[] = []
    for (const word of Object.keys(this.keywords)) {
      if (text.includes(word)) {
        labels.push(this.keywords[word])
      }
    }
    return labels
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

const pornCategories = ['yes_sexual_activity', 'animal_genitalia_and_human']
const nudeCategories = ['yes_male_nudity', 'yes_female_nudity']

export const summarizeLabels = (classes: HiveRespClass[]): string[] => {
  const labels: string[] = []
  for (const cls of classes) {
    // TODO(bnewbold): lots more upstream tags could be included here.
    // for example, "sexy" for not nude but still explicit/suggestive,
    // or lolicon (animated, not nude, "sugggestive"
    // sexual: https://docs.thehive.ai/docs/sexual-content
    // note: won't apply "nude" if "porn" already applied
    if (pornCategories.includes(cls.class) && cls.score >= 0.9) {
      labels.push('porn')
    } else if (nudeCategories.includes(cls.class) && cls.score >= 0.9) {
      labels.push('nude')
    }
    // gore and violence: https://docs.thehive.ai/docs/class-descriptions-violence-gore
    if (cls.class === 'very_bloody' && cls.score >= 0.9) {
      labels.push('gore')
    }
    if (cls.class === 'human_corpse' && cls.score >= 0.9) {
      labels.push('corpse')
    }
    if (cls.class === 'yes_self_harm' && cls.score >= 0.9) {
      labels.push('self-harm')
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
