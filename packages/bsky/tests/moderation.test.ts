import { TestNetwork, ImageRef, RecordRef, SeedClient } from '@atproto/dev-env'
import { TID, cidForCbor } from '@atproto/common'
import AtpAgent, {
  ComAtprotoAdminGetModerationStatuses,
  ComAtprotoAdminTakeModerationAction,
  ComAtprotoModerationCreateReport,
} from '@atproto/api'
import { AtUri } from '@atproto/syntax'
import { forSnapshot } from './_util'
import basicSeed from './seeds/basic'
import {
  ACKNOWLEDGE,
  ESCALATE,
  FLAG,
  LABEL,
  REPORT,
  REVERT,
  REVIEWCLOSED,
  REVIEWESCALATED,
  TAKEDOWN,
} from '../src/lexicon/types/com/atproto/admin/defs'
import {
  REASONOTHER,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'
import { PeriodicModerationEventReversal } from '../src'

type BaseCreateReportParams = (
  | { reportedAccount: string }
  | { reportedContent: { uri: string; cid: string } }
) & {
  reporterAccount: string
} & Omit<ComAtprotoModerationCreateReport.InputSchema, 'subject'>

describe('moderation', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const createReport = async ({
    reportedAccount,
    reportedContent,
    reporterAccount,
    ...rest
  }: BaseCreateReportParams) =>
    agent.api.com.atproto.moderation.createReport(
      {
        // Set default type to spam
        reasonType: REASONSPAM,
        ...rest,
        subject: reportedContent
          ? {
              $type: 'com.atproto.repo.strongRef',
              uri: reportedContent.uri,
              cid: reportedContent.cid,
            }
          : {
              $type: 'com.atproto.admin.defs#repoRef',
              did: reportedAccount,
            },
      },
      {
        headers: await network.serviceHeaders(reporterAccount),
        encoding: 'application/json',
      },
    )

  const getStatuses = async (
    params: ComAtprotoAdminGetModerationStatuses.QueryParams,
  ) => {
    const { data } = await agent.api.com.atproto.admin.getModerationStatuses(
      params,
      { headers: network.bsky.adminAuthHeaders() },
    )

    return data
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_moderation',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  describe.only('reporting', () => {
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

  describe.only('actioning', () => {
    it('resolves reports on repos and records.', async () => {
      const post = sc.posts[sc.dids.bob][1].ref

      await Promise.all([
        createReport({
          reasonType: REASONSPAM,
          reportedAccount: sc.dids.bob,
          reporterAccount: sc.dids.alice,
        }),
        createReport({
          reasonType: REASONOTHER,
          reason: 'defamation',
          reportedContent: {
            uri: post.uri.toString(),
            cid: post.cid.toString(),
          },
          reporterAccount: sc.dids.carol,
        }),
      ])

      const { data: takedownBobsAccount } =
        await agent.api.com.atproto.admin.emitModerationEvent(
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

      const moderationStatusOnBobsAccount = await getStatuses({
        subject: sc.dids.bob,
      })

      // Validate that subject status is set to review closed and takendown flag is on
      expect(moderationStatusOnBobsAccount.subjectStatuses[0]).toMatchObject({
        reviewState: REVIEWCLOSED,
        takendown: true,
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.bob,
        },
      })

      // Cleanup
      await agent.api.com.atproto.admin.emitModerationEvent(
        {
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.bob,
          },
          refEventId: takedownBobsAccount.id,
          action: REVERT,
          createdBy: 'did:example:admin',
          comment: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.bsky.adminAuthHeaders(),
        },
      )
    })

    it('supports escalating a subject', async () => {
      const alicesPostRef = sc.posts[sc.dids.alice][0].ref
      const alicesPostSubject = {
        $type: 'com.atproto.repo.strongRef',
        uri: alicesPostRef.uri.toString(),
        cid: alicesPostRef.cid.toString(),
      }
      const { data: action1 } =
        await agent.api.com.atproto.admin.emitModerationEvent(
          {
            action: ESCALATE,
            subject: alicesPostSubject,
            createdBy: 'did:example:admin',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: network.bsky.adminAuthHeaders('triage'),
          },
        )

      const alicesPostStatus = await getStatuses({
        subject: alicesPostRef.uri.toString(),
      })

      expect(alicesPostStatus.subjectStatuses[0]).toMatchObject({
        reviewState: REVIEWESCALATED,
        takendown: false,
        subject: alicesPostSubject,
      })

      // Cleanup
      await agent.api.com.atproto.admin.emitModerationEvent(
        {
          refEventId: action1.id,
          action: REVERT,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: alicesPostRef.uri.toString(),
            cid: alicesPostRef.cid.toString(),
          },
          createdBy: 'did:example:admin',
          comment: 'Y',
        },
        {
          encoding: 'application/json',
          headers: network.bsky.adminAuthHeaders(),
        },
      )
    })

    it('reverses status when revert event is triggered.', async () => {
      const alicesPostRef = sc.posts[sc.dids.alice][0].ref
      const takeAction = async (
        action: ComAtprotoAdminTakeModerationAction.InputSchema['action'],
        overwrites: Partial<ComAtprotoAdminTakeModerationAction.InputSchema> = {},
      ) => {
        const baseAction = {
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: alicesPostRef.uriStr,
            cid: alicesPostRef.cidStr,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        }
        return agent.api.com.atproto.admin.emitModerationEvent(
          {
            action,
            ...baseAction,
            ...overwrites,
          },
          {
            encoding: 'application/json',
            headers: network.bsky.adminAuthHeaders(),
          },
        )
      }
      // Validate that subject status is marked as escalated
      await takeAction(REPORT)
      await takeAction(REPORT)
      await takeAction(ESCALATE)
      const alicesPostStatusAfterEscalation = await getStatuses({
        subject: alicesPostRef.uriStr,
      })
      expect(
        alicesPostStatusAfterEscalation.subjectStatuses[0].reviewState,
      ).toEqual(REVIEWESCALATED)

      // Validate that subject status is marked as takendown
      await takeAction(LABEL, { createLabelVals: ['nsfw'] })
      const { data: takedownAction } = await takeAction(TAKEDOWN)

      const alicesPostStatusAfterTakedown = await getStatuses({
        subject: alicesPostRef.uriStr,
      })
      expect(alicesPostStatusAfterTakedown.subjectStatuses[0]).toMatchObject({
        reviewState: REVIEWCLOSED,
        takendown: true,
      })

      await takeAction(REVERT, { refEventId: takedownAction.id })
      const alicesPostStatusAfterRevert = await getStatuses({
        subject: alicesPostRef.uriStr,
      })
      // Validate that after reverting, the status of the subject is reverted to the last status changing event
      expect(alicesPostStatusAfterRevert.subjectStatuses[0]).toMatchObject({
        reviewState: REVIEWESCALATED,
        takendown: false,
      })
      // Validate that after reverting, the last review date of the subject
      // DOES NOT update to the the last status changing event
      expect(
        new Date(
          alicesPostStatusAfterEscalation.subjectStatuses[0]
            .lastReviewedAt as string,
        ) <
          new Date(
            alicesPostStatusAfterRevert.subjectStatuses[0]
              .lastReviewedAt as string,
          ),
      ).toBeTruthy()
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
      await reverse(action.id, {
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.uriStr,
          cid: post.cidStr,
        },
      })
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
      await reverse(action.id, {
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.uriStr,
          cid: post.cidStr,
        },
      })
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
      await reverse(action.id, {
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.uriStr,
          cid: post.cidStr,
        },
      })
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
      await reverse(action.id, {
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.uriStr,
          cid: post.cidStr,
        },
      })
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
      await reverse(action.id, {
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.bob,
        },
      })
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
      await reverse(action.id, {
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.bob,
        },
      })
      await expect(getRepoLabels(sc.dids.bob)).resolves.toEqual(['kittens'])
    })

    it('does not allow triage moderators to label.', async () => {
      const attemptLabel = agent.api.com.atproto.admin.emitModerationEvent(
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
        await agent.api.com.atproto.admin.emitModerationEvent(
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
      await reverse(action.id, {
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.bob,
        },
      })
    })

    it('does not allow non-full moderators to takedown.', async () => {
      const attemptTakedownTriage =
        agent.api.com.atproto.admin.emitModerationEvent(
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
    it.skip('automatically reverses actions marked with duration', async () => {
      const { data: action } =
        await agent.api.com.atproto.admin.emitModerationEvent(
          {
            action: TAKEDOWN,
            createdBy: 'did:example:moderator',
            reason: 'Y',
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: sc.dids.bob,
            },
            createLabelVals: ['takendown'],
            // Use negative value to set the expiry time in the past so that the action is automatically reversed
            // right away without having to wait n number of hours for a successful assertion
            durationInHours: -1,
          },
          {
            encoding: 'application/json',
            headers: network.bsky.adminAuthHeaders('moderator'),
          },
        )

      const labelsAfterTakedown = await getRepoLabels(sc.dids.bob)
      expect(labelsAfterTakedown).toContain('takendown')
      // In the actual app, this will be instantiated and run on server startup
      const periodicReversal = new PeriodicModerationEventReversal(
        network.bsky.ctx,
      )
      await periodicReversal.findAndRevertDueActions()

      const { data: reversedAction } =
        await agent.api.com.atproto.admin.getModerationEvent(
          { id: action.id },
          { headers: network.bsky.adminAuthHeaders('moderator') },
        )

      // Verify that the automatic reversal is attributed to the original moderator of the temporary action
      // and that the reason is set to indicate that the action was automatically reversed.
      expect(reversedAction.reversal).toMatchObject({
        createdBy: action.createdBy,
        reason: '[SCHEDULED_REVERSAL] Reverting action as originally scheduled',
      })

      // Verify that labels are also reversed when takedown action is reversed
      const labelsAfterReversal = await getRepoLabels(sc.dids.bob)
      expect(labelsAfterReversal).not.toContain('takendown')
    })

    async function actionWithLabels(
      opts: Partial<ComAtprotoAdminTakeModerationAction.InputSchema> & {
        subject: ComAtprotoAdminTakeModerationAction.InputSchema['subject']
      },
    ) {
      const result = await agent.api.com.atproto.admin.emitModerationEvent(
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

    async function reverse(
      actionId: number,
      opts: Partial<ComAtprotoAdminTakeModerationAction.InputSchema> & {
        subject: ComAtprotoAdminTakeModerationAction.InputSchema['subject']
      },
    ) {
      await agent.api.com.atproto.admin.emitModerationEvent(
        {
          action: REVERT,
          refEventId: actionId,
          createdBy: 'did:example:admin',
          reason: 'Y',
          ...opts,
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
      const takeAction = await agent.api.com.atproto.admin.emitModerationEvent(
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
      await agent.api.com.atproto.admin.reverseModerationEvent(
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
