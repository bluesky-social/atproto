import { AtpAgent } from '@atproto/api'
import { Secp256k1Keypair } from '@atproto/crypto'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  TestOzone,
  basicSeed,
  createOzoneDid,
} from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'
import { LABELER_HEADER_NAME } from '../src/util'

describe('labels from 3p labelers', () => {
  let network: TestNetwork
  let ozone: TestOzone
  let thirdPartyLabeler: TestOzone
  let agent: AtpAgent
  let thirdPartyAgent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient
  let thirdPartyModClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_admin_third_party_labeler_main',
    })
    ozone = network.ozone

    const ozoneKey = await Secp256k1Keypair.create({ exportable: true })
    const ozoneDid = await createOzoneDid(network.plc.url, ozoneKey)
    thirdPartyLabeler = await TestOzone.create({
      port: ozone.port + 10,
      plcUrl: network.plc.url,
      signingKey: ozoneKey,
      serverDid: ozoneDid,
      dbPostgresSchema: `ozone_admin_third_party_labeler_third_party`,
      dbPostgresUrl: ozone.ctx.cfg.db.postgresUrl,
      appviewUrl: network.bsky.url,
      appviewDid: network.bsky.ctx.cfg.serverDid,
      appviewPushEvents: true,
      pdsUrl: network.pds.url,
      pdsDid: network.pds.ctx.cfg.service.did,
    })

    thirdPartyAgent = thirdPartyLabeler.getClient()
    agent = ozone.getClient()
    sc = network.getSeedClient()
    modClient = ozone.getModClient()
    thirdPartyModClient = thirdPartyLabeler.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
    await thirdPartyLabeler.close()
  })

  const getPostSubject = () => ({
    $type: 'com.atproto.repo.strongRef',
    uri: sc.posts[sc.dids.alice][0].ref.uriStr,
    cid: sc.posts[sc.dids.alice][0].ref.cidStr,
  })

  const adjustLabels = async ({
    uri,
    cid,
    src,
    createLabelVals = [],
    negateLabelVals = [],
  }: {
    uri: string
    src: string
    cid?: string
    createLabelVals?: string[]
    negateLabelVals?: string[]
  }) => {
    const labelEntries = createLabelVals.map((val) => ({
      uri,
      cid: cid || '',
      val,
      cts: new Date().toISOString(),
      neg: false,
      src,
    }))

    negateLabelVals.forEach((val) => {
      labelEntries.push({
        uri,
        cid: cid || '',
        val,
        cts: new Date().toISOString(),
        neg: true,
        src,
      })
    })
    await network.bsky.db.db.insertInto('label').values(labelEntries).execute()
  }

  const labelAccount = async (
    client: ModeratorClient,
    {
      createLabelVals = [],
      negateLabelVals = [],
    }: { createLabelVals?: string[]; negateLabelVals?: string[] },
  ) => {
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.alice,
    }
    await client.emitEvent(
      {
        subject,
        event: {
          $type: 'tools.ozone.moderation.defs#modEventLabel',
          createLabelVals,
          negateLabelVals,
        },
        createdBy: sc.dids.carol,
      },
      'moderator',
    )
    await adjustLabels({
      createLabelVals,
      negateLabelVals,
      uri: sc.dids.alice,
      src: client.ozone.ctx.cfg.service.did,
    })
  }

  const labelPost = async (
    client: ModeratorClient,
    {
      createLabelVals = [],
      negateLabelVals = [],
    }: { createLabelVals?: string[]; negateLabelVals?: string[] },
  ) => {
    const subject = getPostSubject()
    await client.emitEvent(
      {
        subject,
        event: {
          $type: 'tools.ozone.moderation.defs#modEventLabel',
          createLabelVals,
          negateLabelVals,
        },
        createdBy: sc.dids.carol,
      },
      'moderator',
    )
    await adjustLabels({
      createLabelVals,
      negateLabelVals,
      uri: subject.uri,
      cid: subject.cid,
      src: client.ozone.ctx.cfg.service.did,
    })
  }

  describe('record labels', () => {
    it('includes only labels from current authority by default', async () => {
      await Promise.all([
        labelPost(modClient, { createLabelVals: ['spam'] }),
        labelPost(thirdPartyModClient, { createLabelVals: ['weird'] }),
      ])

      const [
        { data: recordFromCurrentAuthority },
        { data: recordFromThirdParty },
      ] = await Promise.all([
        agent.api.tools.ozone.moderation.getRecord(
          { uri: sc.posts[sc.dids.alice][0].ref.uriStr },
          {
            headers: await ozone.modHeaders(ids.ToolsOzoneModerationGetRecord),
          },
        ),
        thirdPartyAgent.api.tools.ozone.moderation.getRecord(
          { uri: sc.posts[sc.dids.alice][0].ref.uriStr },
          {
            headers: await thirdPartyLabeler.modHeaders(
              ids.ToolsOzoneModerationGetRecord,
            ),
          },
        ),
      ])

      const currentAuthorityLabels = recordFromCurrentAuthority.labels?.map(
        (l) => l.val,
      )
      const thirdPartyLabels = recordFromThirdParty.labels?.map((l) => l.val)
      expect(currentAuthorityLabels).toContain('spam')
      expect(currentAuthorityLabels).not.toContain('weird')
      expect(thirdPartyLabels).toContain('weird')
      expect(thirdPartyLabels).not.toContain('spam')
    })

    it('includes labels from all authorities requested via header', async () => {
      const authHeaders = await ozone.modHeaders(
        ids.ToolsOzoneModerationGetRecord,
      )
      const { data: recordIncludingExternalLabels } =
        await agent.api.tools.ozone.moderation.getRecord(
          { uri: sc.posts[sc.dids.alice][0].ref.uriStr },
          {
            headers: {
              ...authHeaders,
              [LABELER_HEADER_NAME]: [
                thirdPartyLabeler.ctx.cfg.service.did,
                ozone.ctx.cfg.service.did,
              ].join(','),
            },
          },
        )
      const labelVals = recordIncludingExternalLabels.labels?.map((l) => l.val)
      const labelSources = recordIncludingExternalLabels.labels?.map(
        (l) => l.src,
      )
      expect(labelVals).toContain('weird')
      expect(labelVals).toContain('spam')
      expect(labelSources).toContain(thirdPartyLabeler.ctx.cfg.service.did)
      expect(labelSources).toContain(ozone.ctx.cfg.service.did)
    })
  })

  describe('repo labels', () => {
    it('includes only labels from current authority by default', async () => {
      await Promise.all([
        labelAccount(modClient, { createLabelVals: ['spam'] }),
        labelAccount(thirdPartyModClient, { createLabelVals: ['weird'] }),
      ])

      const [{ data: repoFromCurrentAuthority }, { data: repoFromThirdParty }] =
        await Promise.all([
          agent.api.tools.ozone.moderation.getRepo(
            { did: sc.dids.alice },
            {
              headers: await ozone.modHeaders(ids.ToolsOzoneModerationGetRepo),
            },
          ),
          thirdPartyAgent.api.tools.ozone.moderation.getRepo(
            { did: sc.dids.alice },
            {
              headers: await thirdPartyLabeler.modHeaders(
                ids.ToolsOzoneModerationGetRepo,
              ),
            },
          ),
        ])

      const currentAuthorityLabels = repoFromCurrentAuthority.labels?.map(
        (l) => l.val,
      )
      const thirdPartyLabels = repoFromThirdParty.labels?.map((l) => l.val)
      expect(currentAuthorityLabels).toContain('spam')
      expect(currentAuthorityLabels).not.toContain('weird')
      expect(thirdPartyLabels).toContain('weird')
      expect(thirdPartyLabels).not.toContain('spam')
    })

    it('includes labels from all authorities requested via header', async () => {
      const authHeaders = await ozone.modHeaders(
        ids.ToolsOzoneModerationGetRepo,
      )
      const { data: recordIncludingExternalLabels } =
        await agent.api.tools.ozone.moderation.getRepo(
          { did: sc.dids.alice },
          {
            headers: {
              ...authHeaders,
              [LABELER_HEADER_NAME]: [
                thirdPartyLabeler.ctx.cfg.service.did,
                ozone.ctx.cfg.service.did,
              ].join(','),
            },
          },
        )
      const labelVals = recordIncludingExternalLabels.labels?.map((l) => l.val)
      const labelSources = recordIncludingExternalLabels.labels?.map(
        (l) => l.src,
      )
      expect(labelVals).toContain('weird')
      expect(labelVals).toContain('spam')
      expect(labelSources).toContain(thirdPartyLabeler.ctx.cfg.service.did)
      expect(labelSources).toContain(ozone.ctx.cfg.service.did)
    })
  })
})
