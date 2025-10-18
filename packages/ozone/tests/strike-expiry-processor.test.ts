import AtpAgent from '@atproto/api'
import { SECOND } from '@atproto/common'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'
import { SeverityLevelSettingKey } from '../src/setting/constants'

const strikeConfig = {
  'sev-1': {
    strikeCount: 1,
    expiresInDays: 0, // Set to 0 so we can use future timestamps
  },
  'sev-2': {
    strikeCount: 2,
    expiresInDays: 0,
  },
}

describe('strike expiry processor', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient

  const repoSubject = (did: string) => ({
    $type: 'com.atproto.admin.defs#repoRef',
    did,
  })

  const configureSeverityLevels = async () => {
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

  const getAccountStatus = async (did: string) => {
    const { subjectStatuses } = await modClient.queryStatuses({ subject: did })
    return subjectStatuses[0]
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_strike_expiry_processor',
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

  it('processes expired strikes and updates active strike count', async () => {
    const bobDid = sc.dids.bob
    const bobPost1 = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[bobDid][0].ref.uriStr,
      cid: sc.posts[bobDid][0].ref.cidStr,
    }
    const bobPost2 = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[bobDid][1].ref.uriStr,
      cid: sc.posts[bobDid][1].ref.cidStr,
    }

    // first strike on a post that expires in 2 seconds
    const expiresAt1 = new Date(Date.now() + 2 * SECOND).toISOString()
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-2',
        strikeCount: 2,
        strikeExpiresAt: expiresAt1,
        comment: 'First violation - expires soon',
      },
      subject: bobPost1,
    })

    // second strike on another post that expires in 3 seconds
    const expiresAt2 = new Date(Date.now() + 3 * SECOND).toISOString()
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        strikeCount: 1,
        severityLevel: 'sev-1',
        strikeExpiresAt: expiresAt2,
        comment: 'Second violation - expires later',
      },
      subject: bobPost2,
    })

    // account-level event to ensure account status is created
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventComment',
        comment: 'Account under review',
      },
      subject: repoSubject(bobDid),
    })

    // Verify initial state - both strikes are active
    let status = await getAccountStatus(bobDid)
    expect(status.accountStrike).toBeDefined()
    expect(status.accountStrike!.activeStrikeCount).toBe(3) // 2 + 1
    expect(status.accountStrike!.totalStrikeCount).toBe(3)

    // Wait for first strike to expire
    await new Promise((resolve) => setTimeout(resolve, 2.1 * SECOND))

    // Run the processor
    await network.ozone.daemon.ctx.strikeExpiryProcessor.processExpiredStrikes()

    // Verify first strike expired - only second strike remains active
    status = await getAccountStatus(bobDid)
    expect(status.accountStrike).toBeDefined()
    expect(status.accountStrike!.activeStrikeCount).toBe(1) // Only second strike
    expect(status.accountStrike!.totalStrikeCount).toBe(3) // Total unchanged

    // Wait for second strike to expire
    await new Promise((resolve) => setTimeout(resolve, 1 * SECOND))

    // Run the processor again
    await network.ozone.daemon.ctx.strikeExpiryProcessor.processExpiredStrikes()

    // Verify all strikes expired
    status = await getAccountStatus(bobDid)
    expect(status.accountStrike).toBeDefined()
    expect(status.accountStrike!.activeStrikeCount).toBe(0)
    expect(status.accountStrike!.totalStrikeCount).toBe(3) // Total unchanged
  })

  it('handles accounts with no expired strikes', async () => {
    const aliceDid = sc.dids.alice

    // strike that expires far in the future
    const expiresAt = new Date(Date.now() + 1000 * SECOND).toISOString()
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-2',
        strikeCount: 2,
        strikeExpiresAt: expiresAt,
        comment: 'Future expiry',
      },
      subject: repoSubject(aliceDid),
    })

    // Get initial state
    let status = await getAccountStatus(aliceDid)
    expect(status.accountStrike).toBeDefined()
    const initialActiveCount = status.accountStrike!.activeStrikeCount!
    expect(initialActiveCount).toBe(2)

    await network.ozone.daemon.ctx.strikeExpiryProcessor.processExpiredStrikes()

    // Verify nothing changed
    status = await getAccountStatus(aliceDid)
    expect(status.accountStrike).toBeDefined()
    expect(status.accountStrike!.activeStrikeCount).toBe(initialActiveCount)
  })

  it('handles strikes with no expiry date (permanent strikes)', async () => {
    const carolDid = sc.dids.carol

    // permanent strike (no expiry)
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-2',
        strikeCount: 2,
        comment: 'Permanent strike - no expiry',
      },
      subject: repoSubject(carolDid),
    })

    // Get initial state
    let status = await getAccountStatus(carolDid)
    expect(status.accountStrike).toBeDefined()
    expect(status.accountStrike!.activeStrikeCount).toBe(2)

    await network.ozone.daemon.ctx.strikeExpiryProcessor.processExpiredStrikes()

    // Verify permanent strikes remain active
    status = await getAccountStatus(carolDid)
    expect(status.accountStrike).toBeDefined()
    expect(status.accountStrike!.activeStrikeCount).toBe(2)
    expect(status.accountStrike!.totalStrikeCount).toBe(2)
  })

  it('processes multiple accounts with expired strikes in batch', async () => {
    const danDid = 'did:plc:dan'
    const eveDid = 'did:plc:eve'

    const expiresAt = new Date(Date.now() + 1 * SECOND).toISOString()

    // strikes to multiple accounts
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-1',
        strikeCount: 1,
        strikeExpiresAt: expiresAt,
        comment: 'Dan violation',
      },
      subject: repoSubject(danDid),
    })

    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-2',
        strikeCount: 2,
        strikeExpiresAt: expiresAt,
        comment: 'Eve violation',
      },
      subject: repoSubject(eveDid),
    })

    // Verify initial states
    let danStatus = await getAccountStatus(danDid)
    let eveStatus = await getAccountStatus(eveDid)
    expect(danStatus.accountStrike?.activeStrikeCount).toBe(1)
    expect(eveStatus.accountStrike?.activeStrikeCount).toBe(2)

    // Wait for strikes to expire
    await new Promise((resolve) => setTimeout(resolve, 1.1 * SECOND))

    await network.ozone.daemon.ctx.strikeExpiryProcessor.processExpiredStrikes()

    // Verify both accounts' strikes expired
    danStatus = await getAccountStatus(danDid)
    eveStatus = await getAccountStatus(eveDid)
    expect(danStatus.accountStrike?.activeStrikeCount).toBe(0)
    expect(eveStatus.accountStrike?.activeStrikeCount).toBe(0)
  })

  it('updates cursor to track last processed timestamp', async () => {
    const frankDid = 'did:plc:frank'
    const expiresAt = new Date(Date.now() + 1 * SECOND).toISOString()

    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        severityLevel: 'sev-1',
        strikeCount: 1,
        strikeExpiresAt: expiresAt,
        comment: 'Frank violation',
      },
      subject: repoSubject(frankDid),
    })

    // Wait for strike to expire
    await new Promise((resolve) => setTimeout(resolve, 1.1 * SECOND))

    // Get cursor before processing
    const cursorBefore =
      await network.ozone.daemon.ctx.strikeExpiryProcessor.getCursor()

    await network.ozone.daemon.ctx.strikeExpiryProcessor.processExpiredStrikes()

    // Get cursor after processing
    const cursorAfter =
      await network.ozone.daemon.ctx.strikeExpiryProcessor.getCursor()

    expect(cursorAfter).not.toBe(cursorBefore)
    expect(cursorAfter).toBeTruthy()

    // Verify strike was processed
    const status = await getAccountStatus(frankDid)
    expect(status.accountStrike?.activeStrikeCount).toBe(0)

    // running processor again should not reprocess the same strike
    await network.ozone.daemon.ctx.strikeExpiryProcessor.processExpiredStrikes()
    const cursorAfterSecond =
      await network.ozone.daemon.ctx.strikeExpiryProcessor.getCursor()
    expect(cursorAfterSecond).not.toBe(cursorAfter)
  })
})
