import {
  AtpAgent,
  ChatBskyConvoDefs,
  ToolsOzoneModerationEmitEvent,
} from '@atproto/api'
import { HOUR } from '@atproto/common'
import {
  ImageRef,
  ModeratorClient,
  RecordRef,
  SeedClient,
  TestNetwork,
  TestOzone,
  basicSeed,
} from '@atproto/dev-env'
import { AtUri } from '@atproto/syntax'
import { EventReverser } from '../src'
import { ImageInvalidator } from '../src/image-invalidator'
import { ids } from '../src/lexicon/lexicons'
import {
  REASONMISLEADING,
  REASONOTHER,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'
import {
  ModEventLabel,
  REVIEWCLOSED,
  REVIEWESCALATED,
} from '../src/lexicon/types/tools/ozone/moderation/defs'
import { TAKEDOWN_LABEL } from '../src/mod-service'
import { forSnapshot, identity } from './_util'

describe('moderation', () => {
  let network: TestNetwork
  let ozone: TestOzone
  let mockInvalidator: MockInvalidator
  let agent: AtpAgent
  let bskyAgent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient

  const repoSubject = (did: string) => ({
    $type: 'com.atproto.admin.defs#repoRef',
    did,
  })

  const recordSubject = (ref: RecordRef) => ({
    $type: 'com.atproto.repo.strongRef',
    uri: ref.uriStr,
    cid: ref.cidStr,
  })

  const getLabel = async (uri: string, val: string, neg = false) => {
    return ozone.ctx.db.db
      .selectFrom('label')
      .selectAll()
      .where('uri', '=', uri)
      .where('val', '=', val)
      .where('neg', '=', neg)
      .executeTakeFirst()
  }

  beforeAll(async () => {
    mockInvalidator = new MockInvalidator()
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_moderation',
      ozone: {
        imgInvalidator: mockInvalidator,
        cdnPaths: ['/path1/%s/%s', '/path2/%s/%s'],
      },
    })
    ozone = network.ozone
    agent = network.ozone.getClient()
    bskyAgent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('reporting', () => {
    it('creates reports of a repo.', async () => {
      const reportA = await sc.createReport({
        reasonType: REASONSPAM,
        subject: repoSubject(sc.dids.bob),
        reportedBy: sc.dids.alice,
      })
      const reportB = await sc.createReport({
        reasonType: REASONOTHER,
        reason: 'impersonation',
        subject: repoSubject(sc.dids.bob),
        reportedBy: sc.dids.carol,
      })
      expect(forSnapshot([reportA, reportB])).toMatchSnapshot()
    })

    it("allows reporting a repo that doesn't exist.", async () => {
      const promise = sc.createReport({
        reasonType: REASONSPAM,
        subject: repoSubject('did:plc:unknown'),
        reportedBy: sc.dids.alice,
      })
      await expect(promise).resolves.toBeDefined()
    })

    it('creates reports of a record.', async () => {
      const postA = sc.posts[sc.dids.bob][0].ref
      const postB = sc.posts[sc.dids.bob][1].ref
      const reportA = await sc.createReport({
        reportedBy: sc.dids.alice,
        reasonType: REASONSPAM,
        subject: recordSubject(postA),
      })
      const reportB = await sc.createReport({
        reasonType: REASONOTHER,
        reason: 'defamation',
        subject: recordSubject(postB),
        reportedBy: sc.dids.carol,
      })
      expect(forSnapshot([reportA, reportB])).toMatchSnapshot()
    })

    it("allows reporting a record that doesn't exist.", async () => {
      const postA = sc.posts[sc.dids.bob][0].ref
      const postB = sc.posts[sc.dids.bob][1].ref
      const postUriBad = new AtUri(postA.uriStr)
      postUriBad.rkey = 'badrkey'

      const promiseA = sc.createReport({
        reasonType: REASONSPAM,
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: postUriBad.toString(),
          cid: postA.cidStr,
        },
        reportedBy: sc.dids.alice,
      })
      await expect(promiseA).resolves.toBeDefined()

      const promiseB = sc.createReport({
        reasonType: REASONOTHER,
        reason: 'defamation',
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: postB.uri.toString(),
          cid: postA.cidStr, // bad cid
        },
        reportedBy: sc.dids.carol,
      })
      await expect(promiseB).resolves.toBeDefined()
    })

    it('creates reports of a DM chat.', async () => {
      const messageId1 = 'testmessageid1'
      const messageId2 = 'testmessageid2'
      const reportA = await sc.createReport({
        reportedBy: sc.dids.alice,
        reasonType: REASONSPAM,
        // @ts-expect-error "chat.bsky.convo.defs#messageRef" is not spec'd as subject
        subject: identity<ChatBskyConvoDefs.MessageRef>({
          $type: 'chat.bsky.convo.defs#messageRef',
          did: sc.dids.carol,
          messageId: messageId1,
          convoId: 'testconvoid1',
        }),
      })
      const reportB = await sc.createReport({
        reportedBy: sc.dids.carol,
        reasonType: REASONOTHER,
        reason: 'defamation',
        // @ts-expect-error "chat.bsky.convo.defs#messageRef" is not spec'd as subject
        subject: identity<ChatBskyConvoDefs.MessageRef>({
          $type: 'chat.bsky.convo.defs#messageRef',
          did: sc.dids.carol,
          messageId: messageId2,
          // @ts-expect-error convoId intentionally missing, restore once this behavior is deprecated
          convoId: undefined,
        }),
      })
      expect(forSnapshot([reportA, reportB])).toMatchSnapshot()
      const events = await ozone.ctx.db.db
        .selectFrom('moderation_event')
        .selectAll()
        .where('subjectMessageId', 'in', [messageId1, messageId2])
        .where('action', '=', 'tools.ozone.moderation.defs#modEventReport')
        .execute()
      expect(events.length).toBe(2)
      expect(
        events.every(
          (row) => row.subjectType === 'chat.bsky.convo.defs#messageRef',
        ),
      ).toBe(true)
    })
  })

  describe('actioning', () => {
    it('resolves reports on repos and records.', async () => {
      const post = sc.posts[sc.dids.bob][1].ref

      await Promise.all([
        sc.createReport({
          reasonType: REASONSPAM,
          subject: repoSubject(sc.dids.bob),
          reportedBy: sc.dids.alice,
        }),
        sc.createReport({
          reasonType: REASONOTHER,
          reason: 'defamation',
          subject: recordSubject(post),
          reportedBy: sc.dids.carol,
        }),
      ])

      await modClient.performTakedown({
        subject: repoSubject(sc.dids.bob),
      })

      const moderationStatusOnBobsAccount = await modClient.queryStatuses({
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
      await modClient.performReverseTakedown({
        subject: repoSubject(sc.dids.bob),
      })
    })

    it('supports escalating a subject', async () => {
      const alicesPostRef = sc.posts[sc.dids.alice][0].ref
      const alicesPostSubject = {
        $type: 'com.atproto.repo.strongRef',
        uri: alicesPostRef.uri.toString(),
        cid: alicesPostRef.cid.toString(),
      }
      await modClient.emitEvent(
        {
          event: {
            $type: 'tools.ozone.moderation.defs#modEventEscalate',
            comment: 'Y',
          },
          subject: alicesPostSubject,
          createdBy: 'did:example:admin',
        },
        'triage',
      )

      const alicesPostStatus = await modClient.queryStatuses({
        subject: alicesPostRef.uri.toString(),
      })

      expect(alicesPostStatus.subjectStatuses[0]).toMatchObject({
        reviewState: REVIEWESCALATED,
        takendown: false,
        subject: alicesPostSubject,
      })
    })

    it('adds persistent comment on subject through comment event', async () => {
      const alicesPostRef = sc.posts[sc.dids.alice][0].ref
      const alicesPostSubject = {
        $type: 'com.atproto.repo.strongRef',
        uri: alicesPostRef.uri.toString(),
        cid: alicesPostRef.cid.toString(),
      }
      await modClient.emitEvent(
        {
          event: {
            $type: 'tools.ozone.moderation.defs#modEventComment',
            sticky: true,
            comment: 'This is a persistent note',
          },
          subject: alicesPostSubject,
          createdBy: 'did:example:admin',
        },
        'triage',
      )

      const alicesPostStatus = await modClient.queryStatuses({
        subject: alicesPostRef.uri.toString(),
      })

      expect(alicesPostStatus.subjectStatuses[0].comment).toEqual(
        'This is a persistent note',
      )
    })

    it('reverses status when revert event is triggered.', async () => {
      const alicesPostRef = sc.posts[sc.dids.alice][0].ref
      const emitModEvent = async (
        event: ToolsOzoneModerationEmitEvent.InputSchema['event'],
        overwrites: Partial<ToolsOzoneModerationEmitEvent.InputSchema> = {},
      ) => {
        const baseAction = {
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: alicesPostRef.uriStr,
            cid: alicesPostRef.cidStr,
          },
          createdBy: 'did:example:admin',
        }
        return modClient.emitEvent({
          event,
          ...baseAction,
          ...overwrites,
        })
      }
      // Validate that subject status is marked as escalated
      await emitModEvent({
        $type: 'tools.ozone.moderation.defs#modEventReport',
        reportType: REASONSPAM,
      })
      await emitModEvent({
        $type: 'tools.ozone.moderation.defs#modEventReport',
        reportType: REASONMISLEADING,
      })
      await emitModEvent({
        $type: 'tools.ozone.moderation.defs#modEventEscalate',
      })
      const alicesPostStatusAfterEscalation = await modClient.queryStatuses({
        subject: alicesPostRef.uriStr,
      })
      expect(
        alicesPostStatusAfterEscalation.subjectStatuses[0].reviewState,
      ).toEqual(REVIEWESCALATED)

      // Validate that subject status is marked as takendown

      await emitModEvent({
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: ['nsfw'],
        negateLabelVals: [],
      })
      await emitModEvent({
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
      })

      const alicesPostStatusAfterTakedown = await modClient.queryStatuses({
        subject: alicesPostRef.uriStr,
      })
      expect(alicesPostStatusAfterTakedown.subjectStatuses[0]).toMatchObject({
        reviewState: REVIEWCLOSED,
        takendown: true,
      })

      await emitModEvent({
        $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
      })
      const alicesPostStatusAfterRevert = await modClient.queryStatuses({
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
      const { ctx } = ozone
      const post = sc.posts[sc.dids.bob][0].ref
      const bobsPostSubject = {
        $type: 'com.atproto.repo.strongRef',
        uri: post.uriStr,
        cid: post.cidStr,
      }
      const modService = ctx.modService(ctx.db)
      await modService.formatAndCreateLabels(post.uriStr, post.cidStr, {
        create: ['kittens'],
      })
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
      await modService.formatAndCreateLabels(post.uriStr, post.cidStr, {
        negate: ['kittens'],
      })
    })

    it('no-ops when negating an already-negated label and reverses.', async () => {
      const { ctx } = ozone
      const post = sc.posts[sc.dids.bob][0].ref
      const modService = ctx.modService(ctx.db)
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
      await modService.formatAndCreateLabels(post.uriStr, post.cidStr, {
        negate: ['bears'],
      })
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
      const { ctx } = ozone
      const modService = ctx.modService(ctx.db)
      await modService.formatAndCreateLabels(sc.dids.bob, null, {
        create: ['kittens'],
      })
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

    it('creates expiring label', async () => {
      await emitLabelEvent({
        createLabelVals: ['temp'],
        negateLabelVals: [],
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.bob,
        },
        durationInHours: 24,
      })
      const repo = await getRepo(sc.dids.bob)
      // Losely check that the expiry date is set to above 23 hours from now
      expect(
        `${repo?.labels?.[0].exp}` >
          new Date(Date.now() + 23 * HOUR).toISOString(),
      ).toBeTruthy()
    })

    it('does not allow triage moderators to label.', async () => {
      const attemptLabel = modClient.emitEvent(
        {
          event: {
            $type: 'tools.ozone.moderation.defs#modEventLabel',
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
        'triage',
      )
      await expect(attemptLabel).rejects.toThrow(
        'Must be a full moderator to label content',
      )
    })

    it('does not allow take down event on takendown post or reverse takedown on available post.', async () => {
      await modClient.performTakedown({
        subject: repoSubject(sc.dids.bob),
      })
      await expect(
        modClient.performTakedown({
          subject: repoSubject(sc.dids.bob),
        }),
      ).rejects.toThrow('Subject is already taken down')

      // Cleanup
      await modClient.performReverseTakedown({
        subject: repoSubject(sc.dids.bob),
      })
      await expect(
        modClient.performReverseTakedown({
          subject: repoSubject(sc.dids.bob),
        }),
      ).rejects.toThrow('Subject is not taken down')
    })

    it('fans out repo takedowns', async () => {
      await modClient.performTakedown({
        subject: repoSubject(sc.dids.bob),
      })
      await ozone.processAll()

      const pdsRes1 = await pdsAgent.api.com.atproto.admin.getSubjectStatus(
        {
          did: sc.dids.bob,
        },
        { headers: network.pds.adminAuthHeaders() },
      )
      expect(pdsRes1.data.takedown?.applied).toBe(true)

      const bskyRes1 = await bskyAgent.api.com.atproto.admin.getSubjectStatus(
        {
          did: sc.dids.bob,
        },
        { headers: network.pds.adminAuthHeaders() },
      )
      expect(bskyRes1.data.takedown?.applied).toBe(true)

      const takedownLabel1 = await getLabel(sc.dids.bob, TAKEDOWN_LABEL)
      expect(takedownLabel1).toBeDefined()

      // cleanup
      await modClient.performReverseTakedown({
        subject: repoSubject(sc.dids.bob),
      })
      await ozone.processAll()

      const pdsRes2 = await pdsAgent.api.com.atproto.admin.getSubjectStatus(
        {
          did: sc.dids.bob,
        },
        { headers: network.pds.adminAuthHeaders() },
      )
      expect(pdsRes2.data.takedown?.applied).toBe(false)

      const bskyRes2 = await bskyAgent.api.com.atproto.admin.getSubjectStatus(
        {
          did: sc.dids.bob,
        },
        { headers: network.bsky.adminAuthHeaders() },
      )
      expect(bskyRes2.data.takedown?.applied).toBe(false)

      const takedownLabel2 = await getLabel(sc.dids.bob, TAKEDOWN_LABEL)
      expect(takedownLabel2).toBeUndefined()
    })

    it('allows full moderators to takedown.', async () => {
      await modClient.emitEvent(
        {
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTakedown',
          },
          createdBy: 'did:example:moderator',
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.bob,
          },
        },
        'moderator',
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
      const attemptTakedownTriage = modClient.emitEvent(
        {
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTakedown',
          },
          createdBy: 'did:example:moderator',
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.bob,
          },
        },
        'triage',
      )
      await expect(attemptTakedownTriage).rejects.toThrow(
        'Must be a full moderator to take this type of action',
      )
    })

    it('automatically reverses actions marked with duration', async () => {
      await sc.createReport({
        reasonType: REASONSPAM,
        subject: repoSubject(sc.dids.bob),
        reportedBy: sc.dids.alice,
      })
      const action = await modClient.performTakedown({
        subject: repoSubject(sc.dids.bob),
        // Use negative value to set the expiry time in the past so that the action is automatically reversed
        // right away without having to wait n number of hours for a successful assertion
        durationInHours: -1,
      })
      await ozone.processAll()

      const statusesAfterTakedown = await modClient.queryStatuses(
        { subject: sc.dids.bob },
        'moderator',
      )

      expect(statusesAfterTakedown.subjectStatuses[0]).toMatchObject({
        takendown: true,
      })

      // In the actual app, this will be instantiated and run on server startup
      const reverser = new EventReverser(
        network.ozone.ctx.db,
        // @ts-expect-error Error due to circular dependency with the dev-env package
        network.ozone.ctx.modService,
      )
      await reverser.findAndRevertDueActions()
      await ozone.processAll()

      const [eventList, statuses] = await Promise.all([
        modClient.queryEvents({ subject: sc.dids.bob }, 'moderator'),
        modClient.queryStatuses({ subject: sc.dids.bob }, 'moderator'),
      ])

      expect(statuses.subjectStatuses[0]).toMatchObject({
        takendown: false,
        reviewState: REVIEWCLOSED,
      })
      // Verify that the automatic reversal is attributed to the original moderator of the temporary action
      // and that the reason is set to indicate that the action was automatically reversed.
      expect(eventList.events[0]).toMatchObject({
        createdBy: action.createdBy,
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
          comment:
            '[SCHEDULED_REVERSAL] Reverting action as originally scheduled',
        },
      })
    })

    async function emitLabelEvent(
      opts: Partial<ToolsOzoneModerationEmitEvent.InputSchema> & {
        subject: ToolsOzoneModerationEmitEvent.InputSchema['subject']
        createLabelVals: ModEventLabel['createLabelVals']
        negateLabelVals: ModEventLabel['negateLabelVals']
        durationInHours?: ModEventLabel['durationInHours']
      },
    ) {
      const { createLabelVals, negateLabelVals, durationInHours } = opts
      const event = await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventLabel',
          createLabelVals,
          negateLabelVals,
          durationInHours,
        },
        createdBy: 'did:example:admin',
        reason: 'Y',
        ...opts,
      })
      return event
    }

    async function reverse(
      opts: Partial<ToolsOzoneModerationEmitEvent.InputSchema> & {
        subject: ToolsOzoneModerationEmitEvent.InputSchema['subject']
      },
    ) {
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReverseTakedown',
        },
        createdBy: 'did:example:admin',
        reason: 'Y',
        ...opts,
      })
    }

    async function getRecordLabels(uri: string) {
      const result = await agent.tools.ozone.moderation.getRecord(
        { uri },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneModerationGetRecord,
          ),
        },
      )
      const labels = result.data.labels ?? []
      return labels.map((l) => l.val)
    }

    async function getRepo(did: string) {
      const result = await agent.tools.ozone.moderation.getRepo(
        { did },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneModerationGetRepo,
          ),
        },
      )
      return result.data
    }

    async function getRepoLabels(did: string) {
      const result = await getRepo(did)
      const labels = result.labels ?? []
      return labels.map((l) => l.val)
    }
  })

  describe('blob takedown', () => {
    let post: { ref: RecordRef; images: ImageRef[] }
    let blob: ImageRef
    let imageUri: string
    beforeAll(async () => {
      const { ctx } = network.bsky
      post = sc.posts[sc.dids.carol][0]
      blob = post.images[1]
      imageUri = ctx.views.imgUriBuilder
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
      await modClient.performTakedown({
        subject: recordSubject(post.ref),
        subjectBlobCids: [blob.image.ref.toString()],
      })
      await ozone.processAll()
    })

    it('sets blobCids in moderation status', async () => {
      const { subjectStatuses } = await modClient.queryStatuses({
        subject: post.ref.uriStr,
      })

      expect(subjectStatuses[0].subjectBlobCids).toEqual([
        blob.image.ref.toString(),
      ])
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

    // @TODO add back in with image invalidation, see bluesky-social/atproto#2087
    it.skip('prevents image blob from being served, even when cached.', async () => {
      const fetchImage = await fetch(imageUri)
      expect(fetchImage.status).toEqual(404)
      expect(await fetchImage.json()).toMatchObject({
        message: 'Blob not found',
      })
    })

    it('invalidates the image in the cdn', async () => {
      const blobCid = blob.image.ref.toString()
      expect(mockInvalidator.invalidated.length).toBe(1)
      expect(mockInvalidator.invalidated.at(0)?.subject).toBe(blobCid)
      expect(mockInvalidator.invalidated.at(0)?.paths.at(0)).toEqual(
        `/path1/${sc.dids.carol}/${blobCid}`,
      )
      expect(mockInvalidator.invalidated.at(0)?.paths.at(1)).toEqual(
        `/path2/${sc.dids.carol}/${blobCid}`,
      )
    })

    it('fans takedown out to pds', async () => {
      const res = await pdsAgent.api.com.atproto.admin.getSubjectStatus(
        {
          did: sc.dids.carol,
          blob: blob.image.ref.toString(),
        },
        { headers: network.pds.adminAuthHeaders() },
      )
      expect(res.data.takedown?.applied).toBe(true)
    })

    it('restores blob when action is reversed.', async () => {
      await modClient.performReverseTakedown({
        subject: recordSubject(post.ref),
        subjectBlobCids: [blob.image.ref.toString()],
      })

      await ozone.processAll()

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

    it('fans reversal out to pds', async () => {
      const res = await pdsAgent.api.com.atproto.admin.getSubjectStatus(
        {
          did: sc.dids.carol,
          blob: blob.image.ref.toString(),
        },
        { headers: network.pds.adminAuthHeaders() },
      )
      expect(res.data.takedown?.applied).toBe(false)
    })
  })
})

class MockInvalidator implements ImageInvalidator {
  invalidated: { subject: string; paths: string[] }[] = []

  async invalidate(subject: string, paths: string[]) {
    this.invalidated.push({ subject, paths })
  }
}
