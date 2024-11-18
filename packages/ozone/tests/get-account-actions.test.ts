import {
  TestNetwork,
  SeedClient,
  basicSeed,
  ModeratorClient,
} from '@atproto/dev-env'
import AtpAgent, { ToolsOzoneHistoryGetAccountActions } from '@atproto/api'
import { forSnapshot } from './_util'
import {
  REASONSPAM,
  REASONMISLEADING,
} from '../src/lexicon/types/com/atproto/moderation/defs'
import { MODACTIONLABEL } from '../src/lexicon/types/tools/ozone/history/defs'

type UserWithAgent = {
  agent?: AtpAgent
  token: string
}

describe('get-account-actions', () => {
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
    await sc.createReport({
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.carol,
      },
      reasonType: REASONMISLEADING,
      reason: 'alice says carol is bad',
      reportedBy: sc.dids.alice,
    })
    await sc.createReport({
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.carol][0].ref.uriStr,
        cid: sc.posts[sc.dids.carol][0].ref.cidStr,
      },
      reasonType: REASONMISLEADING,
      reason: 'alice says carol cannot post',
      reportedBy: sc.dids.alice,
    })
    await sc.createReport({
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.bob,
      },
      reasonType: REASONSPAM,
      reason: 'alice says bob is bad',
      reportedBy: sc.dids.alice,
    })
    await sc.createReport({
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.bob][0].ref.uriStr,
        cid: sc.posts[sc.dids.bob][0].ref.cidStr,
      },
      reasonType: REASONSPAM,
      reason: 'alice says bob cannot post',
      reportedBy: sc.dids.alice,
    })
    await sc.createReport({
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.bob][0].ref.uriStr,
        cid: sc.posts[sc.dids.bob][0].ref.cidStr,
      },
      reasonType: REASONSPAM,
      reason: 'carol also says bob cannot post',
      reportedBy: sc.dids.carol,
    })
  }

  const getActions = async (
    user: UserWithAgent,
    params: ToolsOzoneHistoryGetAccountActions.QueryParams,
  ) => {
    if (!user.agent) {
      throw new Error('User agent not set')
    }
    const { data } = await user.agent.tools.ozone.history.getAccountActions(
      params,
      {
        headers: {
          Authorization: `Bearer ${user.token}`,
          'atproto-proxy': `${network.ozone.ctx.cfg.service.did}#atproto_labeler`,
        },
      },
    )

    return data.subjects
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_get_account_actions',
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

  it("returns all subjects that were actioned on the caller's account", async () => {
    const [actionsOnCarol, actionsOnBob] = await Promise.all([
      getActions(carol, {}),
      getActions(bob, {}),
    ])

    expect(forSnapshot(actionsOnCarol)).toMatchSnapshot()
    expect(forSnapshot(actionsOnBob)).toMatchSnapshot()
  })

  it('returns updated subject status after mod action', async () => {
    const bobsPostSubject = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.bob][0].ref.uriStr,
      cid: sc.posts[sc.dids.bob][0].ref.cidStr,
    }
    await Promise.all([
      modClient.emitEvent(
        {
          event: {
            $type: 'tools.ozone.moderation.defs#modEventLabel',
            createLabelVals: ['spam'],
            negateLabelVals: [],
          },
          subject: bobsPostSubject,
        },
        'admin',
      ),
      modClient.emitEvent(
        {
          event: {
            $type: 'tools.ozone.moderation.defs#modEventAcknowledge',
          },
          subject: bobsPostSubject,
        },
        'admin',
      ),
    ])

    const actionsOnBob = await getActions(bob, {})

    const actionOnBobsPost = actionsOnBob.find(
      (item) => item.subject === sc.posts[sc.dids.bob][0].ref.uriStr,
    )?.modAction

    expect(actionOnBobsPost).toEqual(MODACTIONLABEL)
  })
})
