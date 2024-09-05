import {
  TestNetwork,
  TestOzone,
  ImageRef,
  RecordRef,
  SeedClient,
  basicSeed,
  ModeratorClient,
} from '@atproto/dev-env'
import { AtpAgent, ToolsOzoneModerationEmitEvent } from '@atproto/api'
import { AtUri } from '@atproto/syntax'
import { forSnapshot } from './_util'
import {
  REASONAPPEAL,
  REASONMISLEADING,
  REASONOTHER,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'
import {
  ModEventLabel,
  REVIEWCLOSED,
  REVIEWESCALATED,
  REVIEWOPEN,
} from '../src/lexicon/types/tools/ozone/moderation/defs'
import { EventReverser } from '../src'
import { ImageInvalidator } from '../src/image-invalidator'
import { TAKEDOWN_LABEL } from '../src/mod-service'
import { ids } from '../src/lexicon/lexicons'

describe('moderation', () => {
  let network: TestNetwork
  let ozone: TestOzone
  let agent: AtpAgent
  let bskyAgent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient

  const repoSubject = (did: string) => ({
    $type: 'com.atproto.admin.defs#repoRef',
    did,
  })

  const recordSubject = (ref: RecordRef) => ({
    $type: 'com.atproto.repo.strongRef',
    uri: ref.uriStr,
    cid: ref.cidStr,
  })

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_ack_all_subjects_of_account',
    })
    ozone = network.ozone
    agent = network.ozone.getClient()
    bskyAgent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('acknowledges all open/escalated review subjects.', async () => {
    const postOne = sc.posts[sc.dids.bob][0].ref
    const postTwo = sc.posts[sc.dids.bob][1].ref
    await Promise.all([
      sc.createReport({
        reasonType: REASONSPAM,
        subject: repoSubject(sc.dids.bob),
        reportedBy: sc.dids.alice,
      }),
      sc.createReport({
        reasonType: REASONOTHER,
        reason: 'defamation',
        subject: recordSubject(postOne),
        reportedBy: sc.dids.carol,
      }),
      sc.createReport({
        reasonType: REASONOTHER,
        reason: 'defamation',
        subject: recordSubject(postTwo),
        reportedBy: sc.dids.carol,
      }),
    ])

    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventReport',
        reportType: REASONAPPEAL,
      },
      subject: recordSubject(postTwo),
    })

    const { subjectStatuses: statusesBefore } = await modClient.queryStatuses({
      forAccount: sc.dids.bob,
    })

    await modClient.performTakedown({
      subject: repoSubject(sc.dids.bob),
      acknowledgeAllSubjectsOfAccount: true,
    })

    const { subjectStatuses: statusesAfter } = await modClient.queryStatuses({
      forAccount: sc.dids.bob,
    })

    statusesBefore.forEach((item) => {
      if (item.subject.uri === postOne.uriStr) {
        expect(item.reviewState).toBe(REVIEWOPEN)
      } else if (item.subject.uri === postTwo.uriStr) {
        expect(item.reviewState).toBe(REVIEWESCALATED)
        expect(item.appealed).toBe(true)
      } else if (!item.subject.uri && item.subject.did === sc.dids.bob) {
        expect(item.reviewState).toBe(REVIEWOPEN)
      }
    })

    statusesAfter.forEach((item) => {
      if (item.subject.uri === postOne.uriStr) {
        expect(item.reviewState).toBe(REVIEWCLOSED)
      } else if (item.subject.uri === postTwo.uriStr) {
        expect(item.reviewState).toBe(REVIEWCLOSED)
        expect(item.appealed).toBe(false)
      } else if (!item.subject.uri && item.subject.did === sc.dids.bob) {
        expect(item.reviewState).toBe(REVIEWCLOSED)
      }
    })
  })
})
