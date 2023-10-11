import { TestNetwork, ImageRef, RecordRef, SeedClient } from '@atproto/dev-env'
import AtpAgent, {
  ComAtprotoAdminEmitModerationEvent,
  ComAtprotoAdminGetModerationStatuses,
  ComAtprotoModerationCreateReport,
} from '@atproto/api'
import { AtUri } from '@atproto/syntax'
import { forSnapshot } from './_util'
import basicSeed from './seeds/basic'
import {
  ModEventLabel,
  ModEventTakedown,
  REVIEWCLOSED,
  REVIEWESCALATED,
  REVIEWOPEN,
} from '../src/lexicon/types/com/atproto/admin/defs'
import {
  REASONMISLEADING,
  REASONOTHER,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'
import { PeriodicModerationEventReversal } from '../src'

type BaseCreateReportParams =
  | { account: string }
  | { content: { uri: string; cid: string } }
type CreateReportParams = BaseCreateReportParams & {
  author: string
} & Omit<ComAtprotoModerationCreateReport.InputSchema, 'subject'>

type TakedownParams = BaseCreateReportParams &
  Omit<ComAtprotoAdminEmitModerationEvent.InputSchema, 'subject'>

describe('moderation', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const createReport = async ({
    account,
    content,
    author,
    ...rest
  }: CreateReportParams) =>
    agent.api.com.atproto.moderation.createReport(
      {
        // Set default type to spam
        reasonType: REASONSPAM,
        ...rest,
        subject: account
          ? {
              $type: 'com.atproto.admin.defs#repoRef',
              did: account,
            }
          : {
              $type: 'com.atproto.repo.strongRef',
              uri: content.uri,
              cid: content.cid,
            },
      },
      {
        headers: await network.serviceHeaders(author),
        encoding: 'application/json',
      },
    )

  const performTakedown = async ({
    account,
    content,
    durationInHours,
    ...rest
  }: TakedownParams & Pick<ModEventTakedown, 'durationInHours'>) =>
    agent.api.com.atproto.admin.emitModerationEvent(
      {
        event: {
          $type: 'com.atproto.admin.defs#modEventTakedown',
          durationInHours,
        },
        subject: account
          ? {
              $type: 'com.atproto.admin.defs#repoRef',
              did: sc.dids.bob,
            }
          : {
              $type: 'com.atproto.repo.strongRef',
              uri: content.uri,
              cid: content.cid,
            },
        createdBy: 'did:example:admin',
        ...rest,
      },
      {
        encoding: 'application/json',
        headers: network.bsky.adminAuthHeaders(),
      },
    )

  const performReverseTakedown = async ({
    account,
    content,
    ...rest
  }: TakedownParams) =>
    agent.api.com.atproto.admin.emitModerationEvent(
      {
        event: {
          $type: 'com.atproto.admin.defs#modEventReverseTakedown',
        },
        subject: account
          ? {
              $type: 'com.atproto.admin.defs#repoRef',
              did: sc.dids.bob,
            }
          : {
              $type: 'com.atproto.repo.strongRef',
              uri: content.uri,
              cid: content.cid,
            },
        createdBy: 'did:example:admin',
        ...rest,
      },
      {
        encoding: 'application/json',
        headers: network.bsky.adminAuthHeaders(),
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
      const { data: reportA } = await createReport({
        reasonType: REASONSPAM,
        account: sc.dids.bob,
        author: sc.dids.alice,
      })
      const { data: reportB } = await createReport({
        reasonType: REASONOTHER,
        reason: 'impersonation',
        account: sc.dids.bob,
        author: sc.dids.carol,
      })
      expect(forSnapshot([reportA, reportB])).toMatchSnapshot()
    })

    it("allows reporting a repo that doesn't exist.", async () => {
      const promise = createReport({
        reasonType: REASONSPAM,
        account: 'did:plc:unknown',
        author: sc.dids.alice,
      })
      await expect(promise).resolves.toBeDefined()
    })

    it('creates reports of a record.', async () => {
      const postA = sc.posts[sc.dids.bob][0].ref
      const postB = sc.posts[sc.dids.bob][1].ref
      const { data: reportA } = await createReport({
        author: sc.dids.alice,
        reasonType: REASONSPAM,
        content: {
          $type: 'com.atproto.repo.strongRef',
          uri: postA.uriStr,
          cid: postA.cidStr,
        },
      })
      const { data: reportB } = await createReport({
        reasonType: REASONOTHER,
        reason: 'defamation',
        content: {
          $type: 'com.atproto.repo.strongRef',
          uri: postB.uriStr,
          cid: postB.cidStr,
        },
        author: sc.dids.carol,
      })
      expect(forSnapshot([reportA, reportB])).toMatchSnapshot()
    })

    it("allows reporting a record that doesn't exist.", async () => {
      const postA = sc.posts[sc.dids.bob][0].ref
      const postB = sc.posts[sc.dids.bob][1].ref
      const postUriBad = new AtUri(postA.uriStr)
      postUriBad.rkey = 'badrkey'

      const promiseA = createReport({
        reasonType: REASONSPAM,
        content: {
          $type: 'com.atproto.repo.strongRef',
          uri: postUriBad.toString(),
          cid: postA.cidStr,
        },
        author: sc.dids.alice,
      })
      await expect(promiseA).resolves.toBeDefined()

      const promiseB = createReport({
        reasonType: REASONOTHER,
        reason: 'defamation',
        content: {
          $type: 'com.atproto.repo.strongRef',
          uri: postB.uri.toString(),
          cid: postA.cidStr, // bad cid
        },
        author: sc.dids.carol,
      })
      await expect(promiseB).resolves.toBeDefined()
    })
  })

  describe.only('actioning', () => {
    it('resolves reports on repos and records.', async () => {
      const post = sc.posts[sc.dids.bob][1].ref

      await Promise.all([
        createReport({
          reasonType: REASONSPAM,
          account: sc.dids.bob,
          author: sc.dids.alice,
        }),
        createReport({
          reasonType: REASONOTHER,
          reason: 'defamation',
          content: {
            uri: post.uri.toString(),
            cid: post.cid.toString(),
          },
          author: sc.dids.carol,
        }),
      ])

      const { data: takedownBobsAccount } = await performTakedown({
        account: sc.dids.bob,
      })

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
      await performReverseTakedown({
        account: sc.dids.bob,
      })
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
            event: {
              $type: 'com.atproto.admin.defs#modEventEscalate',
              comment: 'Y',
            },
            subject: alicesPostSubject,
            createdBy: 'did:example:admin',
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
    })

    it('reverses status when revert event is triggered.', async () => {
      const alicesPostRef = sc.posts[sc.dids.alice][0].ref
      const emitModEvent = async (
        event: ComAtprotoAdminEmitModerationEvent.InputSchema['event'],
        overwrites: Partial<ComAtprotoAdminEmitModerationEvent.InputSchema> = {},
      ) => {
        const baseAction = {
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: alicesPostRef.uriStr,
            cid: alicesPostRef.cidStr,
          },
          createdBy: 'did:example:admin',
        }
        return agent.api.com.atproto.admin.emitModerationEvent(
          {
            event,
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
      await emitModEvent({
        $type: 'com.atproto.admin.defs#modEventReport',
        reportType: REASONSPAM,
      })
      await emitModEvent({
        $type: 'com.atproto.admin.defs#modEventReport',
        reportType: REASONMISLEADING,
      })
      await emitModEvent({
        $type: 'com.atproto.admin.defs#modEventEscalate',
      })
      const alicesPostStatusAfterEscalation = await getStatuses({
        subject: alicesPostRef.uriStr,
      })
      expect(
        alicesPostStatusAfterEscalation.subjectStatuses[0].reviewState,
      ).toEqual(REVIEWESCALATED)

      // Validate that subject status is marked as takendown

      await emitModEvent({
        $type: 'com.atproto.admin.defs#modEventLabel',
        createLabelVals: ['nsfw'],
        negateLabelVals: [],
      })
      const { data: takedownAction } = await emitModEvent({
        $type: 'com.atproto.admin.defs#modEventTakedown',
      })

      const alicesPostStatusAfterTakedown = await getStatuses({
        subject: alicesPostRef.uriStr,
      })
      expect(alicesPostStatusAfterTakedown.subjectStatuses[0]).toMatchObject({
        reviewState: REVIEWCLOSED,
        takendown: true,
      })

      await emitModEvent({
        $type: 'com.atproto.admin.defs#modEventReverseTakedown',
      })
      const alicesPostStatusAfterRevert = await getStatuses({
        subject: alicesPostRef.uriStr,
      })
      // Validate that after reverting, the status of the subject is reverted to the last status changing event
      expect(alicesPostStatusAfterRevert.subjectStatuses[0]).toMatchObject({
        reviewState: REVIEWCLOSED,
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

    it('negates an existing label.', async () => {
      const { ctx } = network.bsky
      const post = sc.posts[sc.dids.bob][0].ref
      const bobsPostSubject = {
        $type: 'com.atproto.repo.strongRef',
        uri: post.uriStr,
        cid: post.cidStr,
      }
      const labelingService = ctx.services.label(ctx.db.getPrimary())
      await labelingService.formatAndCreate(
        ctx.cfg.labelerDid,
        post.uriStr,
        post.cidStr,
        { create: ['kittens'] },
      )
      await emitLabelEvent({
        negateLabelVals: ['kittens'],
        createLabelVals: [],
        subject: bobsPostSubject,
      })
      await expect(getRecordLabels(post.uriStr)).resolves.toEqual([])

      await emitLabelEvent({
        createLabelVals: ['kittens'],
        negateLabelVals: [],
        subject: bobsPostSubject,
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
      await emitLabelEvent({
        negateLabelVals: ['bears'],
        createLabelVals: [],
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.uriStr,
          cid: post.cidStr,
        },
      })
      await expect(getRecordLabels(post.uriStr)).resolves.toEqual([])
      await emitLabelEvent({
        createLabelVals: ['bears'],
        negateLabelVals: [],
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
      await emitLabelEvent({
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
      await emitLabelEvent({
        negateLabelVals: ['puppies', 'doggies'],
        createLabelVals: [],
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.uriStr,
          cid: post.cidStr,
        },
      })
      await expect(getRecordLabels(post.uriStr)).resolves.toEqual([])
    })

    it('creates labels on a repo and reverses.', async () => {
      await emitLabelEvent({
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
      await emitLabelEvent({
        negateLabelVals: ['puppies', 'doggies'],
        createLabelVals: [],
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
      await emitLabelEvent({
        createLabelVals: ['puppies'],
        negateLabelVals: ['kittens'],
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.bob,
        },
      })
      await expect(getRepoLabels(sc.dids.bob)).resolves.toEqual(['puppies'])

      await emitLabelEvent({
        negateLabelVals: ['puppies'],
        createLabelVals: ['kittens'],
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
          event: {
            $type: 'com.atproto.admin.defs#modEventLabel',
            negateLabelVals: ['a'],
            createLabelVals: ['b', 'c'],
          },
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
      await expect(attemptLabel).rejects.toThrow(
        'Must be a full moderator to label content',
      )
    })

    it('allows full moderators to takedown.', async () => {
      await agent.api.com.atproto.admin.emitModerationEvent(
        {
          event: {
            $type: 'com.atproto.admin.defs#modEventTakedown',
          },
          createdBy: 'did:example:moderator',
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
      await reverse({
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
            event: {
              $type: 'com.atproto.admin.defs#modEventTakedown',
            },
            createdBy: 'did:example:moderator',
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
    it('automatically reverses actions marked with duration', async () => {
      await createReport({
        reasonType: REASONSPAM,
        account: sc.dids.bob,
        author: sc.dids.alice,
      })
      const { data: action } = await performTakedown({
        account: sc.dids.bob,
        // Use negative value to set the expiry time in the past so that the action is automatically reversed
        // right away without having to wait n number of hours for a successful assertion
        durationInHours: -1,
      })

      const { data: statusesAfterTakedown } =
        await agent.api.com.atproto.admin.getModerationStatuses(
          { subject: sc.dids.bob },
          { headers: network.bsky.adminAuthHeaders('moderator') },
        )

      expect(statusesAfterTakedown.subjectStatuses[0]).toMatchObject({
        takendown: true,
      })

      // In the actual app, this will be instantiated and run on server startup
      const periodicReversal = new PeriodicModerationEventReversal(
        network.bsky.ctx,
      )
      await periodicReversal.findAndRevertDueActions()

      const [{ data: eventList }, { data: statuses }] = await Promise.all([
        agent.api.com.atproto.admin.getModerationEvents(
          { subject: sc.dids.bob },
          { headers: network.bsky.adminAuthHeaders('moderator') },
        ),
        agent.api.com.atproto.admin.getModerationStatuses(
          { subject: sc.dids.bob },
          { headers: network.bsky.adminAuthHeaders('moderator') },
        ),
      ])

      // Verify that the automatic reversal is attributed to the original moderator of the temporary action
      // and that the reason is set to indicate that the action was automatically reversed.
      expect(eventList.events[0]).toMatchObject({
        createdBy: action.createdBy,
        event: {
          $type: 'com.atproto.admin.defs#modEventReverseTakedown',
          comment:
            '[SCHEDULED_REVERSAL] Reverting action as originally scheduled',
        },
      })
      expect(statuses.subjectStatuses[0]).toMatchObject({
        takendown: false,
        reviewState: REVIEWCLOSED
      })
    })

    async function emitLabelEvent(
      opts: Partial<ComAtprotoAdminEmitModerationEvent.InputSchema> & {
        subject: ComAtprotoAdminEmitModerationEvent.InputSchema['subject']
        createLabelVals: ModEventLabel['createLabelVals']
        negateLabelVals: ModEventLabel['negateLabelVals']
      },
    ) {
      const { createLabelVals, negateLabelVals, ...rest } = opts
      const result = await agent.api.com.atproto.admin.emitModerationEvent(
        {
          event: {
            $type: 'com.atproto.admin.defs#modEventLabel',
            createLabelVals,
            negateLabelVals,
          },
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
      opts: Partial<ComAtprotoAdminEmitModerationEvent.InputSchema> & {
        subject: ComAtprotoAdminEmitModerationEvent.InputSchema['subject']
      },
    ) {
      await agent.api.com.atproto.admin.emitModerationEvent(
        {
          event: {
            $type: 'com.atproto.admin.defs#modEventReverseTakedown',
          },
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
      const emitModEvent =
        await agent.api.com.atproto.admin.emitModerationEvent(
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
      actionId = emitModEvent.data.id
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
