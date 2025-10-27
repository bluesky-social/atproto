import AtpAgent from '@atproto/api'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'
import { SeverityLevelSettingKey } from '../src/setting/constants'
import { forSnapshot } from './_util'

const strikeConfig = {
  'sev-0': { strikeCount: 0 },
  'sev-1': {
    strikeCount: 1,
    strikeOnOccurrence: 2,
    expiresInDays: 365,
  },
  'sev-2': { strikeCount: 2, expiresInDays: 365 },
  'sev-4': { strikeCount: 4, expiresInDays: 0 },
  'sev-5': { needsTakedown: true },
}

describe('account-strikes', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient

  const repoSubject = (did: string) => ({
    $type: 'com.atproto.admin.defs#repoRef',
    did,
  })

  const configureSeverityLevels = async () => {
    // Configure severity level settings
    await agent.tools.ozone.setting.upsertOption(
      {
        scope: 'instance',
        key: SeverityLevelSettingKey,
        value: strikeConfig,
        description: 'Severity level configuration for strike system',
        managerRole: 'tools.ozone.team.defs#roleAdmin',
      },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneSettingUpsertOption,
          'admin',
        ),
      },
    )
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_account_strikes',
    })
    agent = network.ozone.getClient()
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
    await configureSeverityLevels()
  })

  afterAll(async () => {
    await network.close()
  })

  it('tracks strikes and exposes them through queryStatuses and queryEvents', async () => {
    const aliceSubject = repoSubject(sc.dids.alice)
    const alicePost = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.alice][0].ref.uriStr,
      cid: sc.posts[sc.dids.alice][0].ref.cidStr,
    }

    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-2',
        strikeCount: strikeConfig['sev-2'].strikeCount,
        comment: 'First violation',
      },
      subject: alicePost,
    })

    const alicePost2 = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.alice][1].ref.uriStr,
      cid: sc.posts[sc.dids.alice][1].ref.cidStr,
    }
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-2',
        strikeCount: strikeConfig['sev-2'].strikeCount,
        comment: 'Second violation',
      },
      subject: alicePost2,
    })

    const alicePost3 = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.alice][2].ref.uriStr,
      cid: sc.posts[sc.dids.alice][2].ref.cidStr,
    }
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-1',
        strikeCount: 0, // First occurrence - warning
        policies: ['spam-policy'],
        comment: 'First sev-1 violation',
      },
      subject: alicePost3,
    })

    // Issue second sev-1 takedown with same policy on another post (second occurrence, should be 1 strike, total 5)
    const aliceReply = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.replies[sc.dids.alice][0].ref.uriStr,
      cid: sc.replies[sc.dids.alice][0].ref.cidStr,
    }
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-1',
        strikeCount: strikeConfig['sev-1'].strikeCount, // Second occurrence - actual strike
        policies: ['spam-policy'],
        comment: 'Second sev-1 violation',
      },
      subject: aliceReply,
    })

    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-0',
        strikeCount: strikeConfig['sev-0'].strikeCount,
        comment: 'Warning only',
      },
      subject: aliceSubject,
    })

    let statusResult = await modClient.queryStatuses({
      subject: sc.dids.alice,
    })

    expect(statusResult.subjectStatuses.length).toBeGreaterThan(0)
    expect(forSnapshot(statusResult.subjectStatuses[0])).toMatchSnapshot()
    const strikeCountBefore =
      statusResult.subjectStatuses[0].accountStrike?.activeStrikeCount

    // Reverse one of the takedowns with negative strikeCount
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
        severityLevel: 'sev-2',
        strikeCount: -2, // Negative to reverse strikes
        comment: 'Appeal granted - reversing first takedown',
      },
      subject: alicePost,
    })

    // Verify strikes were reduced (if strikeCount tracking is implemented)
    statusResult = await modClient.queryStatuses({
      subject: sc.dids.alice,
    })
    const strikeCountAfter =
      statusResult.subjectStatuses[0].accountStrike?.activeStrikeCount
    expect(strikeCountAfter).toBe(3)
    expect(strikeCountAfter).toBeLessThan(strikeCountBefore!)

    const eventsWithStrikes = await modClient.queryEvents({
      subject: sc.dids.alice,
      includeAllUserRecords: true,
      withStrike: true,
    })

    expect(forSnapshot(eventsWithStrikes.events)).toMatchSnapshot()
  })
})
