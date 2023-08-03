import axios from 'axios'
import FormData from 'form-data'
import { CID } from 'multiformats/cid'
import { IdResolver } from '@atproto/identity'
import { Labeler } from './base'
import { keywordLabeling } from './util'
import Database from '../db'
import { BackgroundQueue } from '../background'
import { IndexerConfig } from '../indexer/config'
import { retryHttp } from '../util/retry'
import { resolveBlob } from '../api/blob-resolver'
import { labelerLogger as log } from '../logger'

const HIVE_ENDPOINT = 'https://api.thehive.ai/api/v2/task/sync'

export class HiveLabeler extends Labeler {
  hiveApiKey: string
  keywords: Record<string, string>

  constructor(
    hiveApiKey: string,
    protected ctx: {
      db: Database
      idResolver: IdResolver
      cfg: IndexerConfig
      backgroundQueue: BackgroundQueue
    },
  ) {
    super(ctx)
    this.hiveApiKey = hiveApiKey
    this.keywords = ctx.cfg.labelerKeywords
  }

  async labelText(text: string): Promise<string[]> {
    return keywordLabeling(this.keywords, text)
  }

  async labelImg(did: string, cid: CID): Promise<string[]> {
    const hiveRes = await retryHttp(async () => {
      try {
        return await this.makeHiveReq(did, cid)
      } catch (err) {
        log.warn({ err, did, cid: cid.toString() }, 'hive request failed')
        throw err
      }
    })
    log.info({ hiveRes, did, cid: cid.toString() }, 'hive response')
    const classes = respToClasses(hiveRes)
    return summarizeLabels(classes)
  }

  async makeHiveReq(did: string, cid: CID): Promise<HiveResp> {
    const { stream } = await resolveBlob(did, cid, this.ctx)
    const form = new FormData()
    form.append('media', stream)
    const { data } = await axios.post(HIVE_ENDPOINT, form, {
      headers: {
        'Content-Type': 'multipart/form-data',
        authorization: `token ${this.hiveApiKey}`,
        accept: 'application/json',
      },
    })
    return data
  }
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
}
const labelForClassLessSensitive = {
  yes_self_harm: 'self-harm',
}

export const summarizeLabels = (classes: HiveRespClass[]): string[] => {
  const labels: string[] = sexualLabels(classes)
  for (const cls of classes) {
    if (labelForClass[cls.class] && cls.score >= 0.9) {
      labels.push(labelForClass[cls.class])
    }
  }
  for (const cls of classes) {
    if (labelForClassLessSensitive[cls.class] && cls.score >= 0.96) {
      labels.push(labelForClassLessSensitive[cls.class])
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
