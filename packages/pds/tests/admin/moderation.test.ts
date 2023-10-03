import {
  TestNetworkNoAppView,
  ImageRef,
  RecordRef,
  SeedClient,
} from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { AtUri } from '@atproto/syntax'
import { BlobNotFoundError } from '@atproto/repo'
import { forSnapshot } from '../_util'
import { PeriodicModerationActionReversal } from '../../src/db/periodic-moderation-action-reversal'
import basicSeed from '../seeds/basic'
import {
  ACKNOWLEDGE,
  ESCALATE,
  FLAG,
  TAKEDOWN,
} from '../../src/lexicon/types/com/atproto/admin/defs'
import {
  REASONOTHER,
  REASONSPAM,
} from '../../src/lexicon/types/com/atproto/moderation/defs'

describe('moderation', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'moderation',
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
  })

  afterAll(async () => {
    await network.close()
  })

  describe('reporting', () => {
    it('creates reports of a repo.', async () => {
      const { data: reportA } =
        await agent.api.com.atproto.moderation.createReport(
          {
            reasonType: REASONSPAM,
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: sc.dids.bob,
            },
          },
          {
            headers: sc.getHeaders(sc.dids.alice),
            encoding: 'application/json',
          },
        )
      const { data: reportB } =
        await agent.api.com.atproto.moderation.createReport(
          {
            reasonType: REASONOTHER,
            reason: 'impersonation',
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: sc.dids.bob,
            },
          },
          {
            headers: sc.getHeaders(sc.dids.carol),
            encoding: 'application/json',
          },
        )
      expect(forSnapshot([reportA, reportB])).toMatchSnapshot()
    })

    it("fails reporting a repo that doesn't exist.", async () => {
      const promise = agent.api.com.atproto.moderation.createReport(
        {
          reasonType: REASONSPAM,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: 'did:plc:unknown',
          },
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )
      await expect(promise).rejects.toThrow('Repo not found')
    })

    it('creates reports of a record.', async () => {
      const postA = sc.posts[sc.dids.bob][0].ref
      const postB = sc.posts[sc.dids.bob][1].ref
      const { data: reportA } =
        await agent.api.com.atproto.moderation.createReport(
          {
            reasonType: REASONSPAM,
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: postA.uriStr,
              cid: postA.cidStr,
            },
          },
          {
            headers: sc.getHeaders(sc.dids.alice),
            encoding: 'application/json',
          },
        )
      const { data: reportB } =
        await agent.api.com.atproto.moderation.createReport(
          {
            reasonType: REASONOTHER,
            reason: 'defamation',
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: postB.uriStr,
              cid: postB.cidStr,
            },
          },
          {
            headers: sc.getHeaders(sc.dids.carol),
            encoding: 'application/json',
          },
        )
      expect(forSnapshot([reportA, reportB])).toMatchSnapshot()
    })

    it("fails reporting a record that doesn't exist.", async () => {
      const postA = sc.posts[sc.dids.bob][0].ref
      const postB = sc.posts[sc.dids.bob][1].ref
      const postUriBad = new AtUri(postA.uriStr)
      postUriBad.rkey = 'badrkey'

      const promiseA = agent.api.com.atproto.moderation.createReport(
        {
          reasonType: REASONSPAM,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: postUriBad.toString(),
            cid: postA.cidStr,
          },
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )
      await expect(promiseA).rejects.toThrow('Record not found')

      const promiseB = agent.api.com.atproto.moderation.createReport(
        {
          reasonType: REASONOTHER,
          reason: 'defamation',
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: postB.uri.toString(),
            cid: postA.cidStr, // bad cid
          },
        },
        { headers: sc.getHeaders(sc.dids.carol), encoding: 'application/json' },
      )
      await expect(promiseB).rejects.toThrow('Record not found')
    })
  })

  describe('actioning', () => {
    it('resolves reports on repos and records.', async () => {
      const { data: reportA } =
        await agent.api.com.atproto.moderation.createReport(
          {
            reasonType: REASONSPAM,
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: sc.dids.bob,
            },
          },
          {
            headers: sc.getHeaders(sc.dids.alice),
            encoding: 'application/json',
          },
        )
      const post = sc.posts[sc.dids.bob][1].ref
      const { data: reportB } =
        await agent.api.com.atproto.moderation.createReport(
          {
            reasonType: REASONOTHER,
            reason: 'defamation',
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: post.uri.toString(),
              cid: post.cid.toString(),
            },
          },
          {
            headers: sc.getHeaders(sc.dids.carol),
            encoding: 'application/json',
          },
        )
      const { data: action } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: TAKEDOWN,
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: sc.dids.bob,
            },
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: network.pds.adminAuthHeaders(),
          },
        )
      const { data: actionResolvedReports } =
        await agent.api.com.atproto.admin.resolveModerationReports(
          {
            actionId: action.id,
            reportIds: [reportB.id, reportA.id],
            createdBy: 'did:example:admin',
          },
          {
            encoding: 'application/json',
            headers: network.pds.adminAuthHeaders(),
          },
        )

      expect(forSnapshot(actionResolvedReports)).toMatchSnapshot()

      // Cleanup
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: action.id,
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
    })

    it('resolves reports on missing repos and records.', async () => {
      // Create fresh user
      const deleteme = await sc.createAccount('deleteme', {
        email: 'deleteme.test@bsky.app',
        handle: 'deleteme.test',
        password: 'password',
      })
      const post = await sc.post(deleteme.did, 'delete this post')
      // Report user and post
      const { data: reportA } =
        await agent.api.com.atproto.moderation.createReport(
          {
            reasonType: REASONSPAM,
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: deleteme.did,
            },
          },
          {
            headers: sc.getHeaders(sc.dids.alice),
            encoding: 'application/json',
          },
        )
      const { data: reportB } =
        await agent.api.com.atproto.moderation.createReport(
          {
            reasonType: REASONOTHER,
            reason: 'defamation',
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: post.ref.uriStr,
              cid: post.ref.cidStr,
            },
          },
          {
            headers: sc.getHeaders(sc.dids.carol),
            encoding: 'application/json',
          },
        )
      // Delete full user account
      await agent.api.com.atproto.server.requestAccountDelete(undefined, {
        headers: sc.getHeaders(deleteme.did),
      })
      const { token: deletionToken } = await network.pds.ctx.db.db
        .selectFrom('email_token')
        .where('purpose', '=', 'delete_account')
        .where('did', '=', deleteme.did)
        .selectAll()
        .executeTakeFirstOrThrow()
      await agent.api.com.atproto.server.deleteAccount({
        did: deleteme.did,
        password: 'password',
        token: deletionToken,
      })
      await network.processAll()
      // Take action on deleted content
      const { data: action } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: FLAG,
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: post.ref.uriStr,
              cid: post.ref.cidStr,
            },
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: network.pds.adminAuthHeaders(),
          },
        )
      await agent.api.com.atproto.admin.resolveModerationReports(
        {
          actionId: action.id,
          reportIds: [reportB.id, reportA.id],
          createdBy: 'did:example:admin',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
      // Check report and action details
      const { data: repoDeletionActionDetail } =
        await agent.api.com.atproto.admin.getModerationAction(
          { id: action.id - 1 },
          { headers: network.pds.adminAuthHeaders() },
        )
      const { data: recordActionDetail } =
        await agent.api.com.atproto.admin.getModerationAction(
          { id: action.id },
          { headers: network.pds.adminAuthHeaders() },
        )
      const { data: reportADetail } =
        await agent.api.com.atproto.admin.getModerationReport(
          { id: reportA.id },
          { headers: network.pds.adminAuthHeaders() },
        )
      const { data: reportBDetail } =
        await agent.api.com.atproto.admin.getModerationReport(
          { id: reportB.id },
          { headers: network.pds.adminAuthHeaders() },
        )
      expect(
        forSnapshot({
          repoDeletionActionDetail,
          recordActionDetail,
          reportADetail,
          reportBDetail,
        }),
      ).toMatchSnapshot()
      // Cleanup
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: action.id,
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
    })

    it('does not resolve report for mismatching repo.', async () => {
      const { data: report } =
        await agent.api.com.atproto.moderation.createReport(
          {
            reasonType: REASONSPAM,
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: sc.dids.bob,
            },
          },
          {
            headers: sc.getHeaders(sc.dids.alice),
            encoding: 'application/json',
          },
        )
      const { data: action } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: TAKEDOWN,
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: sc.dids.carol,
            },
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: network.pds.adminAuthHeaders(),
          },
        )

      const promise = agent.api.com.atproto.admin.resolveModerationReports(
        {
          actionId: action.id,
          reportIds: [report.id],
          createdBy: 'did:example:admin',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )

      await expect(promise).rejects.toThrow(
        'Report 9 cannot be resolved by action',
      )

      // Cleanup
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: action.id,
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
    })

    it('does not resolve report for mismatching record.', async () => {
      const postRef1 = sc.posts[sc.dids.alice][0].ref
      const postRef2 = sc.posts[sc.dids.bob][0].ref
      const { data: report } =
        await agent.api.com.atproto.moderation.createReport(
          {
            reasonType: REASONSPAM,
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: postRef1.uriStr,
              cid: postRef1.cidStr,
            },
          },
          {
            headers: sc.getHeaders(sc.dids.alice),
            encoding: 'application/json',
          },
        )
      const { data: action } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: TAKEDOWN,
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: postRef2.uriStr,
              cid: postRef2.cidStr,
            },
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: network.pds.adminAuthHeaders(),
          },
        )

      const promise = agent.api.com.atproto.admin.resolveModerationReports(
        {
          actionId: action.id,
          reportIds: [report.id],
          createdBy: 'did:example:admin',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )

      await expect(promise).rejects.toThrow(
        'Report 10 cannot be resolved by action',
      )

      // Cleanup
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: action.id,
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
    })

    it('supports escalating and acknowledging for triage.', async () => {
      const postRef1 = sc.posts[sc.dids.alice][0].ref
      const postRef2 = sc.posts[sc.dids.bob][0].ref
      const { data: action1 } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: ESCALATE,
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: postRef1.uri.toString(),
              cid: postRef1.cid.toString(),
            },
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: network.pds.adminAuthHeaders('triage'),
          },
        )
      expect(action1).toEqual(
        expect.objectContaining({
          action: ESCALATE,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: postRef1.uriStr,
            cid: postRef1.cidStr,
          },
        }),
      )
      const { data: action2 } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: ACKNOWLEDGE,
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: postRef2.uri.toString(),
              cid: postRef2.cid.toString(),
            },
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: network.pds.adminAuthHeaders('triage'),
          },
        )
      expect(action2).toEqual(
        expect.objectContaining({
          action: ACKNOWLEDGE,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: postRef2.uriStr,
            cid: postRef2.cidStr,
          },
        }),
      )
      // Cleanup
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: action1.id,
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders('triage'),
        },
      )
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: action2.id,
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders('triage'),
        },
      )
    })

    it('only allows record to have one current action.', async () => {
      const postRef = sc.posts[sc.dids.alice][0].ref
      const { data: acknowledge } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: ACKNOWLEDGE,
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: postRef.uriStr,
              cid: postRef.cidStr,
            },
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: network.pds.adminAuthHeaders(),
          },
        )
      const flagPromise = agent.api.com.atproto.admin.takeModerationAction(
        {
          action: FLAG,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: postRef.uriStr,
            cid: postRef.cidStr,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
      await expect(flagPromise).rejects.toThrow(
        'Subject already has an active action:',
      )

      // Reverse current then retry
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: acknowledge.id,
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
      const { data: flag } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: FLAG,
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: postRef.uriStr,
              cid: postRef.cidStr,
            },
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: network.pds.adminAuthHeaders(),
          },
        )

      // Cleanup
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: flag.id,
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
    })

    it('only allows repo to have one current action.', async () => {
      const { data: acknowledge } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: ACKNOWLEDGE,
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: sc.dids.alice,
            },
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: network.pds.adminAuthHeaders(),
          },
        )
      const flagPromise = agent.api.com.atproto.admin.takeModerationAction(
        {
          action: FLAG,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.alice,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
      await expect(flagPromise).rejects.toThrow(
        'Subject already has an active action:',
      )

      // Reverse current then retry
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: acknowledge.id,
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
      const { data: flag } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: FLAG,
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: sc.dids.alice,
            },
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: network.pds.adminAuthHeaders(),
          },
        )

      // Cleanup
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: flag.id,
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
    })

    it('only allows blob to have one current action.', async () => {
      const img = sc.posts[sc.dids.carol][0].images[0]
      const postA = await sc.post(sc.dids.carol, 'image A', undefined, [img])
      const postB = await sc.post(sc.dids.carol, 'image B', undefined, [img])
      const { data: acknowledge } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: ACKNOWLEDGE,
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: postA.ref.uriStr,
              cid: postA.ref.cidStr,
            },
            subjectBlobCids: [img.image.ref.toString()],
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: network.pds.adminAuthHeaders(),
          },
        )
      const flagPromise = agent.api.com.atproto.admin.takeModerationAction(
        {
          action: FLAG,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: postB.ref.uriStr,
            cid: postB.ref.cidStr,
          },
          subjectBlobCids: [img.image.ref.toString()],
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
      await expect(flagPromise).rejects.toThrow(
        'Blob already has an active action:',
      )
      // Reverse current then retry
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: acknowledge.id,
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
      const { data: flag } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: FLAG,
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: postB.ref.uriStr,
              cid: postB.ref.cidStr,
            },
            subjectBlobCids: [img.image.ref.toString()],
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: network.pds.adminAuthHeaders(),
          },
        )

      // Cleanup
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: flag.id,
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
    })

    it('allows full moderators to takedown.', async () => {
      const { data: action } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: TAKEDOWN,
            createdBy: 'did:example:moderator',
            reason: 'Y',
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: sc.dids.bob,
            },
          },
          {
            encoding: 'application/json',
            headers: network.pds.adminAuthHeaders('moderator'),
          },
        )
      // cleanup
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: action.id,
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
    })

    it('automatically reverses actions marked with duration', async () => {
      const { data: action } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: TAKEDOWN,
            createdBy: 'did:example:moderator',
            reason: 'Y',
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: sc.dids.bob,
            },
            // Use negative value to set the expiry time in the past so that the action is automatically reversed
            // right away without having to wait n number of hours for a successful assertion
            durationInHours: -1,
          },
          {
            encoding: 'application/json',
            headers: network.pds.adminAuthHeaders('moderator'),
          },
        )

      // In the actual app, this will be instantiated and run on server startup
      const periodicReversal = new PeriodicModerationActionReversal(
        network.pds.ctx,
      )
      await periodicReversal.findAndRevertDueActions()

      const { data: reversedAction } =
        await agent.api.com.atproto.admin.getModerationAction(
          { id: action.id },
          { headers: network.pds.adminAuthHeaders() },
        )

      // Verify that the automatic reversal is attributed to the original moderator of the temporary action
      // and that the reason is set to indicate that the action was automatically reversed.
      expect(reversedAction.reversal).toMatchObject({
        createdBy: action.createdBy,
        reason: '[SCHEDULED_REVERSAL] Reverting action as originally scheduled',
      })
    })

    it('does not allow non-full moderators to takedown.', async () => {
      const attemptTakedownTriage =
        agent.api.com.atproto.admin.takeModerationAction(
          {
            action: TAKEDOWN,
            createdBy: 'did:example:moderator',
            reason: 'Y',
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: sc.dids.bob,
            },
          },
          {
            encoding: 'application/json',
            headers: network.pds.adminAuthHeaders('triage'),
          },
        )
      await expect(attemptTakedownTriage).rejects.toThrow(
        'Must be a full moderator to perform an account takedown',
      )
    })
  })

  describe('blob takedown', () => {
    let post: { ref: RecordRef; images: ImageRef[] }
    let blob: ImageRef
    let actionId: number

    beforeAll(async () => {
      post = sc.posts[sc.dids.carol][0]
      blob = post.images[1]
      const takeAction = await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: post.ref.uriStr,
            cid: post.ref.cidStr,
          },
          subjectBlobCids: [blob.image.ref.toString()],
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
      actionId = takeAction.data.id
    })

    it('removes blob from the store', async () => {
      const tryGetBytes = network.pds.ctx.blobstore.getBytes(blob.image.ref)
      await expect(tryGetBytes).rejects.toThrow(BlobNotFoundError)
    })

    it('prevents blob from being referenced again.', async () => {
      const uploaded = await sc.uploadFile(
        sc.dids.alice,
        'tests/sample-img/key-alt.jpg',
        'image/jpeg',
      )
      expect(uploaded.image.ref.equals(blob.image.ref)).toBeTruthy()
      const referenceBlob = sc.post(sc.dids.alice, 'pic', [], [blob])
      await expect(referenceBlob).rejects.toThrow('Could not find blob:')
    })

    it('prevents image blob from being served, even when cached.', async () => {
      const attempt = agent.api.com.atproto.sync.getBlob({
        did: sc.dids.carol,
        cid: blob.image.ref.toString(),
      })
      await expect(attempt).rejects.toThrow('Blob not found')
    })

    it('restores blob when action is reversed.', async () => {
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: actionId,
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )

      // Can post and reference blob
      const post = await sc.post(sc.dids.alice, 'pic', [], [blob])
      expect(post.images[0].image.ref.equals(blob.image.ref)).toBeTruthy()

      // Can fetch through image server
      const res = await agent.api.com.atproto.sync.getBlob({
        did: sc.dids.carol,
        cid: blob.image.ref.toString(),
      })

      expect(res.data.byteLength).toBeGreaterThan(9000)
    })
  })
})
