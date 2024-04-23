import {
  SeedClient,
  TestNetwork,
  basicSeed,
  TestOzone,
  ModeratorClient,
  createOzoneDid,
} from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { Secp256k1Keypair } from '@atproto/crypto'
import { LABELER_HEADER_NAME } from '../dist/util'

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
      dbPostgresSchema: 'ozone_admin_third_party_labeler',
    })
    ozone = network.ozone

    const ozoneKey = await Secp256k1Keypair.create({ exportable: true })
    const ozoneDid = await createOzoneDid(network.plc.url, ozoneKey)
    thirdPartyLabeler = await TestOzone.create({
      port: ozone.port + 10,
      plcUrl: network.plc.url,
      signingKey: ozoneKey,
      serverDid: ozoneDid,
      dbPostgresSchema: `ozone_admin_third_party_labeler`,
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
  })

  const getPostSubject = () => ({
    $type: 'com.atproto.repo.strongRef',
    uri: sc.posts[sc.dids.alice][0].ref.uriStr,
    cid: sc.posts[sc.dids.alice][0].ref.cidStr,
  })

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
    const labelEntries = createLabelVals.map((val) => ({
      uri: subject.uri,
      cid: subject.cid,
      val,
      cts: new Date().toISOString(),
      neg: false,
      src: client.ozone.ctx.cfg.service.did,
    }))

    negateLabelVals.forEach((val) => {
      labelEntries.push({
        uri: subject.uri,
        cid: subject.cid,
        val,
        cts: new Date().toISOString(),
        neg: true,
        src: client.ozone.ctx.cfg.service.did,
      })
    })
    await network.bsky.db.db.insertInto('label').values(labelEntries).execute()
  }

  it('includes only labels from current authority by default', async () => {
    await Promise.all([
      labelPost(modClient, { createLabelVals: ['spam'] }),
      labelPost(thirdPartyModClient, { createLabelVals: ['weird'] }),
    ])
    await thirdPartyLabeler.processAll()
    await network.processAll()

    const [
      { data: recordFromCurrentAuthority },
      { data: recordFromThirdParty },
    ] = await Promise.all([
      agent.api.tools.ozone.moderation.getRecord(
        { uri: sc.posts[sc.dids.alice][0].ref.uriStr },
        { headers: await ozone.modHeaders() },
      ),
      thirdPartyAgent.api.tools.ozone.moderation.getRecord(
        { uri: sc.posts[sc.dids.alice][0].ref.uriStr },
        { headers: await thirdPartyLabeler.modHeaders() },
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
    const authHeaders = await ozone.modHeaders()
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
    const labelSources = recordIncludingExternalLabels.labels?.map((l) => l.src)
    expect(labelVals).toContain('weird')
    expect(labelVals).toContain('spam')
    expect(labelSources).toContain(thirdPartyLabeler.ctx.cfg.service.did)
    expect(labelSources).toContain(ozone.ctx.cfg.service.did)
  })
})
