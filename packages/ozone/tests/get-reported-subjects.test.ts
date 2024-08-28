import {
  TestNetwork,
  SeedClient,
  basicSeed,
  ModeratorClient,
} from '@atproto/dev-env'
import AtpAgent, {
  AtUri,
  ToolsOzoneHistoryGetReportedSubjects,
} from '@atproto/api'
import { forSnapshot } from './_util'
import {
  REASONSPAM,
  REASONMISLEADING,
} from '../src/lexicon/types/com/atproto/moderation/defs'
import {
  MODACTIONLABEL,
  MODACTIONPENDING,
} from '../src/lexicon/types/tools/ozone/history/defs'

type UserWithAgent = {
  agent?: AtpAgent
  token: string
}

describe('get-reported-subjects', () => {
  let network: TestNetwork
  let sc: SeedClient
  const alice: UserWithAgent = {
    token: '',
  }
  const carol: UserWithAgent = {
    token: '',
  }
  const bob: UserWithAgent = {
    token: '',
  }
  let modClient: ModeratorClient

  const seedReports = async () => {
    await Promise.all([
      sc.createReport({
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.carol,
        },
        reasonType: REASONMISLEADING,
        reason: 'alice says carol is bad',
        reportedBy: sc.dids.alice,
      }),
      sc.createReport({
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: sc.posts[sc.dids.carol][0].ref.uriStr,
          cid: sc.posts[sc.dids.carol][0].ref.cidStr,
        },
        reasonType: REASONMISLEADING,
        reason: 'alice says carol cannot post',
        reportedBy: sc.dids.alice,
      }),
      sc.createReport({
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.bob,
        },
        reasonType: REASONSPAM,
        reason: 'alice says bob is bad',
        reportedBy: sc.dids.alice,
      }),
      sc.createReport({
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: sc.posts[sc.dids.bob][0].ref.uriStr,
          cid: sc.posts[sc.dids.bob][0].ref.cidStr,
        },
        reasonType: REASONSPAM,
        reason: 'alice says bob cannot post',
        reportedBy: sc.dids.alice,
      }),
      sc.createReport({
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: sc.posts[sc.dids.bob][0].ref.uriStr,
          cid: sc.posts[sc.dids.bob][0].ref.cidStr,
        },
        reasonType: REASONSPAM,
        reason: 'carol also says bob cannot post',
        reportedBy: sc.dids.carol,
      }),
    ])
  }

  const getSubjects = async (
    user: UserWithAgent,
    params: ToolsOzoneHistoryGetReportedSubjects.QueryParams,
  ) => {
    if (!user.agent) {
      throw new Error('User agent not set')
    }
    const { data } = await user.agent.tools.ozone.history.getReportedSubjects(
      params,
      {
        headers: {
          Authorization: `Bearer ${user.token}`,
          'atproto-proxy': `${network.ozone.ctx.cfg.service.did}#atproto_labeler`,
        },
      },
    )

    return data
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_get_reported_subjects',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
    await seedReports()
    alice.agent = network.pds.getClient()
    const { data: alicesLogin } = await alice.agent.login({
      identifier: sc.accounts[sc.dids.alice].handle,
      password: sc.accounts[sc.dids.alice].password,
    })
    carol.agent = network.pds.getClient()
    const { data: carolsLogin } = await carol.agent.login({
      identifier: sc.accounts[sc.dids.carol].handle,
      password: sc.accounts[sc.dids.carol].password,
    })
    bob.agent = network.pds.getClient()
    const { data: bobsLogin } = await bob.agent.login({
      identifier: sc.accounts[sc.dids.bob].handle,
      password: sc.accounts[sc.dids.bob].password,
    })
    alice.token = alicesLogin.accessJwt
    carol.token = carolsLogin.accessJwt
    carol.token = carolsLogin.accessJwt
    bob.token = bobsLogin.accessJwt
  })

  afterAll(async () => {
    await network.close()
  })

  it('returns reported subjects', async () => {
    const [alicesReportedSubjects, carolsReportedSubjects] = await Promise.all([
      getSubjects(alice, {}),
      getSubjects(carol, {}),
    ])

    expect(alicesReportedSubjects.subjects.length).toBe(4)
    expect(carolsReportedSubjects.subjects.length).toBe(1)
  })

  it('returns reported subjects for a specific account and their content', async () => {
    const alicesReportsOnBob = await getSubjects(alice, {
      account: sc.dids.bob,
    })

    const dids = new Set([
      ...alicesReportsOnBob.subjects.map(
        (item) => new AtUri(item.subject.subject).host,
      ),
    ])
    expect(alicesReportsOnBob.subjects.length).toBe(2)
    expect(dids.size).toBe(1)
    expect(dids.has(sc.dids.bob)).toBe(true)
  })

  it('returns updated subject status after mod action', async () => {
    await modClient.emitEvent(
      {
        event: {
          $type: 'tools.ozone.moderation.defs#modEventLabel',
          createLabelVals: ['spam'],
          negateLabelVals: [],
        },
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: sc.posts[sc.dids.bob][0].ref.uriStr,
          cid: sc.posts[sc.dids.bob][0].ref.cidStr,
        },
      },
      'admin',
    )

    const [alicesReportedSubjects, carolsReportedSubjects] = await Promise.all([
      getSubjects(alice, {}),
      getSubjects(carol, {}),
    ])

    const modActionForAlice = alicesReportedSubjects.subjects.find(
      (item) => item.subject.subject === sc.posts[sc.dids.bob][0].ref.uriStr,
    )?.subject.modAction
    const modActionForCarol = carolsReportedSubjects.subjects.find(
      (item) => item.subject.subject === sc.posts[sc.dids.bob][0].ref.uriStr,
    )?.subject.modAction

    expect(modActionForAlice).toEqual(modActionForCarol)
    expect(modActionForAlice).toEqual(MODACTIONLABEL)
  })

  it('prior mod actions are not served to new reporters', async () => {
    // technically, users wouldn't report their own content, but this is a test and we don't have a fourth user
    await sc.createReport({
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.bob][0].ref.uriStr,
        cid: sc.posts[sc.dids.bob][0].ref.cidStr,
      },
      reasonType: REASONMISLEADING,
      reason: 'bob is telling on himself',
      reportedBy: sc.dids.bob,
    })
    const [alicesReportedSubjects, bobsReportedSubjects] = await Promise.all([
      getSubjects(alice, {}),
      getSubjects(bob, {}),
    ])

    const modActionForAlice = alicesReportedSubjects.subjects.find(
      (item) => item.subject.subject === sc.posts[sc.dids.bob][0].ref.uriStr,
    )?.subject.modAction
    const modActionForBob = bobsReportedSubjects.subjects.find(
      (item) => item.subject.subject === sc.posts[sc.dids.bob][0].ref.uriStr,
    )?.subject.modAction

    expect(modActionForAlice).toEqual(MODACTIONLABEL)
    expect(modActionForBob).toEqual(MODACTIONPENDING)
  })
})
