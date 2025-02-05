import { AtpAgent } from '@atproto/api'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  TestOzone,
  basicSeed,
} from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'
import {
  REASONOTHER,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'
import { forSnapshot } from './_util'

describe('admin get repo view', () => {
  let network: TestNetwork
  let ozone: TestOzone
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_admin_get_repo',
    })
    ozone = network.ozone
    agent = ozone.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    modClient = ozone.getModClient()
    await basicSeed(sc)
    await pdsAgent.com.atproto.server.deactivateAccount(
      {},
      { encoding: 'application/json', headers: sc.getHeaders(sc.dids.dan) },
    )
    await network.processAll()
  })

  beforeEach(async () => {
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  beforeAll(async () => {
    await modClient.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })
    await sc.createReport({
      reportedBy: sc.dids.bob,
      reasonType: REASONSPAM,
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })
    await sc.createReport({
      reportedBy: sc.dids.carol,
      reasonType: REASONOTHER,
      reason: 'defamation',
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })
    await modClient.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })
  })

  it('gets a repo by did, even when taken down.', async () => {
    const result = await agent.api.tools.ozone.moderation.getRepo(
      { did: sc.dids.alice },
      { headers: await ozone.modHeaders(ids.ToolsOzoneModerationGetRepo) },
    )
    expect(forSnapshot(result.data)).toMatchSnapshot()
  })

  it('does not include account emails for triage mods.', async () => {
    const { data: admin } = await agent.api.tools.ozone.moderation.getRepo(
      { did: sc.dids.bob },
      { headers: await ozone.modHeaders(ids.ToolsOzoneModerationGetRepo) },
    )
    const { data: moderator } = await agent.api.tools.ozone.moderation.getRepo(
      { did: sc.dids.bob },
      {
        headers: await ozone.modHeaders(
          ids.ToolsOzoneModerationGetRepo,
          'moderator',
        ),
      },
    )
    const { data: triage } = await agent.api.tools.ozone.moderation.getRepo(
      { did: sc.dids.bob },
      {
        headers: await ozone.modHeaders(
          ids.ToolsOzoneModerationGetRepo,
          'triage',
        ),
      },
    )
    expect(admin.email).toEqual('bob@test.com')
    expect(moderator.email).toEqual('bob@test.com')
    expect(triage.email).toBeUndefined()
    expect(triage).toEqual({ ...admin, email: undefined })
  })

  it('includes emailConfirmedAt timestamp', async () => {
    const { data: beforeEmailVerification } =
      await agent.api.tools.ozone.moderation.getRepo(
        { did: sc.dids.bob },
        { headers: await ozone.modHeaders(ids.ToolsOzoneModerationGetRepo) },
      )

    expect(beforeEmailVerification.emailConfirmedAt).toBeUndefined()
    const timestampBeforeVerification = Date.now()
    const bobsAccount = sc.accounts[sc.dids.bob]
    const verificationToken =
      await network.pds.ctx.accountManager.createEmailToken(
        sc.dids.bob,
        'confirm_email',
      )
    await pdsAgent.api.com.atproto.server.confirmEmail(
      { email: bobsAccount.email, token: verificationToken },
      {
        encoding: 'application/json',

        headers: sc.getHeaders(sc.dids.bob),
      },
    )
    const { data: afterEmailVerification } =
      await agent.api.tools.ozone.moderation.getRepo(
        { did: sc.dids.bob },
        { headers: await ozone.modHeaders(ids.ToolsOzoneModerationGetRepo) },
      )

    expect(afterEmailVerification.emailConfirmedAt).toBeTruthy()
    expect(
      new Date(afterEmailVerification.emailConfirmedAt as string).getTime(),
    ).toBeGreaterThan(timestampBeforeVerification)
  })

  it('returns deactivation state', async () => {
    const res = await agent.api.tools.ozone.moderation.getRepo(
      { did: sc.dids.dan },
      { headers: await ozone.modHeaders(ids.ToolsOzoneModerationGetRepo) },
    )

    expect(res.data.deactivatedAt).toBeDefined()
  })

  it('fails when repo does not exist.', async () => {
    const promise = agent.api.tools.ozone.moderation.getRepo(
      { did: 'did:plc:doesnotexist' },
      { headers: await ozone.modHeaders(ids.ToolsOzoneModerationGetRepo) },
    )
    await expect(promise).rejects.toThrow('Repo not found')
  })
})
