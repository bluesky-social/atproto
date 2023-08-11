import { TestNetwork } from '@atproto/dev-env'
import { TID, cidForCbor } from '@atproto/common'
import AtpAgent, { ComAtprotoAdminTakeModerationAction } from '@atproto/api'
import { AtUri } from '@atproto/uri'
import { forSnapshot } from './_util'
import { ImageRef, RecordRef, SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import {
  ACKNOWLEDGE,
  ESCALATE,
  FLAG,
  TAKEDOWN,
} from '../src/lexicon/types/com/atproto/admin/defs'
import {
  REASONOTHER,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'

describe('moderation', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_moderation',
    })
    agent = network.bsky.getClient()
    const pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await network.processAll()
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
            headers: await network.serviceHeaders(sc.dids.alice),
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
            headers: await network.serviceHeaders(sc.dids.carol),
            encoding: 'application/json',
          },
        )
      expect(forSnapshot([reportA, reportB])).toMatchSnapshot()
    })

    it("allows reporting a repo that doesn't exist.", async () => {
      const promise = agent.api.com.atproto.moderation.createReport(
        {
          reasonType: REASONSPAM,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: 'did:plc:unknown',
          },
        },
        {
          headers: await network.serviceHeaders(sc.dids.alice),
          encoding: 'application/json',
        },
      )
      await expect(promise).resolves.toBeDefined()
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
            headers: await network.serviceHeaders(sc.dids.alice),
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
            headers: await network.serviceHeaders(sc.dids.carol),
            encoding: 'application/json',
          },
        )
      expect(forSnapshot([reportA, reportB])).toMatchSnapshot()
    })

    it("allows reporting a record that doesn't exist.", async () => {
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
        {
          headers: await network.serviceHeaders(sc.dids.alice),
          encoding: 'application/json',
        },
      )
      await expect(promiseA).resolves.toBeDefined()

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
        {
          headers: await network.serviceHeaders(sc.dids.carol),
          encoding: 'application/json',
        },
      )
      await expect(promiseB).resolves.toBeDefined()
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
            headers: await network.serviceHeaders(sc.dids.alice),
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
            headers: await network.serviceHeaders(sc.dids.carol),
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
            headers: network.bsky.adminAuthHeaders(),
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
            headers: network.bsky.adminAuthHeaders(),
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
          headers: network.bsky.adminAuthHeaders(),
        },
      )
    })

    it('resolves reports on missing repos and records.', async () => {
      const unknownDid = 'did:plc:unknown'
      const unknownPostUri = `at://did:plc:unknown/app.bsky.feed.post/${TID.nextStr()}`
      const unknownPostCid = (await cidForCbor({})).toString()
      // Report user and post unknown to bsky
      const { data: reportA } =
        await agent.api.com.atproto.moderation.createReport(
          {
            reasonType: REASONSPAM,
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: unknownDid,
            },
          },
          {
            headers: await network.serviceHeaders(sc.dids.alice),
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
              uri: unknownPostUri,
              cid: unknownPostCid,
            },
          },
          {
            headers: await network.serviceHeaders(sc.dids.carol),
            encoding: 'application/json',
          },
        )
      // Take action on deleted content
      const { data: action } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: FLAG,
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: unknownPostUri,
              cid: unknownPostCid,
            },
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: network.bsky.adminAuthHeaders(),
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
          headers: network.bsky.adminAuthHeaders(),
        },
      )
      // Check report and action details
      const { data: recordActionDetail } =
        await agent.api.com.atproto.admin.getModerationAction(
          { id: action.id },
          { headers: network.bsky.adminAuthHeaders() },
        )
      const { data: reportADetail } =
        await agent.api.com.atproto.admin.getModerationReport(
          { id: reportA.id },
          { headers: network.bsky.adminAuthHeaders() },
        )
      const { data: reportBDetail } =
        await agent.api.com.atproto.admin.getModerationReport(
          { id: reportB.id },
          { headers: network.bsky.adminAuthHeaders() },
        )
      expect(
        forSnapshot({
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
          headers: network.bsky.adminAuthHeaders(),
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
            headers: await network.serviceHeaders(sc.dids.alice),
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
            headers: network.bsky.adminAuthHeaders(),
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
          headers: network.bsky.adminAuthHeaders(),
        },
      )

      await expect(promise).rejects.toThrow(
        `Report ${report.id} cannot be resolved by action`,
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
          headers: network.bsky.adminAuthHeaders(),
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
            headers: await network.serviceHeaders(sc.dids.alice),
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
            headers: network.bsky.adminAuthHeaders(),
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
          headers: network.bsky.adminAuthHeaders(),
        },
      )

      await expect(promise).rejects.toThrow(
        `Report ${report.id} cannot be resolved by action`,
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
          headers: network.bsky.adminAuthHeaders(),
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
            headers: network.bsky.adminAuthHeaders('triage'),
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
            headers: network.bsky.adminAuthHeaders('triage'),
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
          headers: network.bsky.adminAuthHeaders('triage'),
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
          headers: network.bsky.adminAuthHeaders('triage'),
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
            headers: network.bsky.adminAuthHeaders(),
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
          headers: network.bsky.adminAuthHeaders(),
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
          headers: network.bsky.adminAuthHeaders(),
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
            headers: network.bsky.adminAuthHeaders(),
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
          headers: network.bsky.adminAuthHeaders(),
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
            headers: network.bsky.adminAuthHeaders(),
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
          headers: network.bsky.adminAuthHeaders(),
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
          headers: network.bsky.adminAuthHeaders(),
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
            headers: network.bsky.adminAuthHeaders(),
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
          headers: network.bsky.adminAuthHeaders(),
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
            headers: network.bsky.adminAuthHeaders(),
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
          headers: network.bsky.adminAuthHeaders(),
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
          headers: network.bsky.adminAuthHeaders(),
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
            headers: network.bsky.adminAuthHeaders(),
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
          headers: network.bsky.adminAuthHeaders(),
        },
      )
    })

    it('negates an existing label and reverses.', async () => {
      const { ctx } = network.bsky
      const post = sc.posts[sc.dids.bob][0].ref
      const labelingService = ctx.services.label(ctx.db.getPrimary())
      await labelingService.formatAndCreate(
        ctx.cfg.labelerDid,
        post.uriStr,
        post.cidStr,
        { create: ['kittens'] },
      )
      const action = await actionWithLabels({
        negateLabelVals: ['kittens'],
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.uriStr,
          cid: post.cidStr,
        },
      })
      await expect(getRecordLabels(post.uriStr)).resolves.toEqual([])
      await reverse(action.id)
      await expect(getRecordLabels(post.uriStr)).resolves.toEqual(['kittens'])
      // Cleanup
      await labelingService.formatAndCreate(
        ctx.cfg.labelerDid,
        post.uriStr,
        post.cidStr,
        { negate: ['kittens'] },
      )
    })

    it('no-ops when negating an already-negated label and reverses.', async () => {
      const { ctx } = network.bsky
      const post = sc.posts[sc.dids.bob][0].ref
      const labelingService = ctx.services.label(ctx.db.getPrimary())
      const action = await actionWithLabels({
        negateLabelVals: ['bears'],
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.uriStr,
          cid: post.cidStr,
        },
      })
      await expect(getRecordLabels(post.uriStr)).resolves.toEqual([])
      await reverse(action.id)
      await expect(getRecordLabels(post.uriStr)).resolves.toEqual(['bears'])
      // Cleanup
      await labelingService.formatAndCreate(
        ctx.cfg.labelerDid,
        post.uriStr,
        post.cidStr,
        { negate: ['bears'] },
      )
    })

    it('creates non-existing labels and reverses.', async () => {
      const post = sc.posts[sc.dids.bob][0].ref
      const action = await actionWithLabels({
        createLabelVals: ['puppies', 'doggies'],
        negateLabelVals: [],
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.uriStr,
          cid: post.cidStr,
        },
      })
      await expect(getRecordLabels(post.uriStr)).resolves.toEqual([
        'puppies',
        'doggies',
      ])
      await reverse(action.id)
      await expect(getRecordLabels(post.uriStr)).resolves.toEqual([])
    })

    it('no-ops when creating an existing label and reverses.', async () => {
      const { ctx } = network.bsky
      const post = sc.posts[sc.dids.bob][0].ref
      const labelingService = ctx.services.label(ctx.db.getPrimary())
      await labelingService.formatAndCreate(
        ctx.cfg.labelerDid,
        post.uriStr,
        post.cidStr,
        { create: ['birds'] },
      )
      const action = await actionWithLabels({
        createLabelVals: ['birds'],
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.uriStr,
          cid: post.cidStr,
        },
      })
      await expect(getRecordLabels(post.uriStr)).resolves.toEqual(['birds'])
      await reverse(action.id)
      await expect(getRecordLabels(post.uriStr)).resolves.toEqual([])
    })

    it('creates labels on a repo and reverses.', async () => {
      const action = await actionWithLabels({
        createLabelVals: ['puppies', 'doggies'],
        negateLabelVals: [],
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.bob,
        },
      })
      await expect(getRepoLabels(sc.dids.bob)).resolves.toEqual([
        'puppies',
        'doggies',
      ])
      await reverse(action.id)
      await expect(getRepoLabels(sc.dids.bob)).resolves.toEqual([])
    })

    it('creates and negates labels on a repo and reverses.', async () => {
      const { ctx } = network.bsky
      const labelingService = ctx.services.label(ctx.db.getPrimary())
      await labelingService.formatAndCreate(
        ctx.cfg.labelerDid,
        sc.dids.bob,
        null,
        { create: ['kittens'] },
      )
      const action = await actionWithLabels({
        createLabelVals: ['puppies'],
        negateLabelVals: ['kittens'],
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.bob,
        },
      })
      await expect(getRepoLabels(sc.dids.bob)).resolves.toEqual(['puppies'])
      await reverse(action.id)
      await expect(getRepoLabels(sc.dids.bob)).resolves.toEqual(['kittens'])
    })

    it('does not allow triage moderators to label.', async () => {
      const attemptLabel = agent.api.com.atproto.admin.takeModerationAction(
        {
          action: ACKNOWLEDGE,
          createdBy: 'did:example:moderator',
          reason: 'Y',
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.bob,
          },
          negateLabelVals: ['a'],
          createLabelVals: ['b', 'c'],
        },
        {
          encoding: 'application/json',
          headers: network.bsky.adminAuthHeaders('triage'),
        },
      )
      await expect(attemptLabel).rejects.toThrow(
        'Must be a full moderator to label content',
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
            headers: network.bsky.adminAuthHeaders('moderator'),
          },
        )
      // cleanup
      await reverse(action.id)
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
            headers: network.bsky.adminAuthHeaders('triage'),
          },
        )
      await expect(attemptTakedownTriage).rejects.toThrow(
        'Must be a full moderator to perform an account takedown',
      )
    })

    async function actionWithLabels(
      opts: Partial<ComAtprotoAdminTakeModerationAction.InputSchema> & {
        subject: ComAtprotoAdminTakeModerationAction.InputSchema['subject']
      },
    ) {
      const result = await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: FLAG,
          createdBy: 'did:example:admin',
          reason: 'Y',
          ...opts,
        },
        {
          encoding: 'application/json',
          headers: network.bsky.adminAuthHeaders(),
        },
      )
      return result.data
    }

    async function reverse(actionId: number) {
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: actionId,
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.bsky.adminAuthHeaders(),
        },
      )
    }

    async function getRecordLabels(uri: string) {
      const result = await agent.api.com.atproto.admin.getRecord(
        { uri },
        { headers: network.bsky.adminAuthHeaders() },
      )
      const labels = result.data.labels ?? []
      return labels.map((l) => l.val)
    }

    async function getRepoLabels(did: string) {
      const result = await agent.api.com.atproto.admin.getRepo(
        { did },
        { headers: network.bsky.adminAuthHeaders() },
      )
      const labels = result.data.labels ?? []
      return labels.map((l) => l.val)
    }
  })

  describe('blob takedown', () => {
    let post: { ref: RecordRef; images: ImageRef[] }
    let blob: ImageRef
    let imageUri: string
    let actionId: number
    beforeAll(async () => {
      const { ctx } = network.bsky
      post = sc.posts[sc.dids.carol][0]
      blob = post.images[1]
      imageUri = ctx.imgUriBuilder
        .getPresetUri(
          'feed_thumbnail',
          sc.dids.carol,
          blob.image.ref.toString(),
        )
        .replace(ctx.cfg.publicUrl || '', network.bsky.url)
      // Warm image server cache
      await fetch(imageUri)
      const cached = await fetch(imageUri)
      expect(cached.headers.get('x-cache')).toEqual('hit')
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
          headers: network.bsky.adminAuthHeaders(),
        },
      )
      actionId = takeAction.data.id
    })

    it('prevents resolution of blob', async () => {
      const blobPath = `/blob/${sc.dids.carol}/${blob.image.ref.toString()}`
      const resolveBlob = await fetch(`${network.bsky.url}${blobPath}`)
      expect(resolveBlob.status).toEqual(404)
      expect(await resolveBlob.json()).toEqual({
        error: 'NotFoundError',
        message: 'Blob not found',
      })
    })

    it('prevents image blob from being served, even when cached.', async () => {
      const fetchImage = await fetch(imageUri)
      expect(fetchImage.status).toEqual(404)
      expect(await fetchImage.json()).toEqual({ message: 'Image not found' })
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
          headers: network.bsky.adminAuthHeaders(),
        },
      )

      // Can resolve blob
      const blobPath = `/blob/${sc.dids.carol}/${blob.image.ref.toString()}`
      const resolveBlob = await fetch(`${network.bsky.url}${blobPath}`)
      expect(resolveBlob.status).toEqual(200)

      // Can fetch through image server
      const fetchImage = await fetch(imageUri)
      expect(fetchImage.status).toEqual(200)
      const size = Number(fetchImage.headers.get('content-length'))
      expect(size).toBeGreaterThan(9000)
    })
  })
})
