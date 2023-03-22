import AtpAgent from '@atproto/api'
import { AtUri } from '@atproto/uri'
import {
  adminAuth,
  CloseFn,
  forSnapshot,
  runTestServer,
  TestServerInfo,
} from './_util'
import { ImageRef, RecordRef, SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import {
  ACKNOWLEDGE,
  FLAG,
  TAKEDOWN,
} from '../src/lexicon/types/com/atproto/admin/moderationAction'
import { OTHER, SPAM } from '../src/lexicon/types/com/atproto/report/reasonType'
import { CID } from 'multiformats/cid'
import { BlobNotFoundError } from '@atproto/repo'

describe('moderation', () => {
  let server: TestServerInfo
  let close: CloseFn
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'moderation',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
  })

  afterAll(async () => {
    await close()
  })

  describe('reporting', () => {
    it('creates reports of a repo.', async () => {
      const { data: reportA } = await agent.api.com.atproto.report.create(
        {
          reasonType: SPAM,
          subject: {
            $type: 'com.atproto.repo.repoRef',
            did: sc.dids.bob,
          },
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )
      const { data: reportB } = await agent.api.com.atproto.report.create(
        {
          reasonType: OTHER,
          reason: 'impersonation',
          subject: {
            $type: 'com.atproto.repo.repoRef',
            did: sc.dids.bob,
          },
        },
        { headers: sc.getHeaders(sc.dids.carol), encoding: 'application/json' },
      )
      expect(forSnapshot([reportA, reportB])).toMatchSnapshot()
    })

    it("fails reporting a repo that doesn't exist.", async () => {
      const promise = agent.api.com.atproto.report.create(
        {
          reasonType: SPAM,
          subject: {
            $type: 'com.atproto.repo.repoRef',
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
      const { data: reportA } = await agent.api.com.atproto.report.create(
        {
          reasonType: SPAM,
          subject: {
            $type: 'com.atproto.repo.recordRef',
            uri: postA.uri.toString(),
          },
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )
      const { data: reportB } = await agent.api.com.atproto.report.create(
        {
          reasonType: OTHER,
          reason: 'defamation',
          subject: {
            $type: 'com.atproto.repo.recordRef',
            uri: postB.uri.toString(),
            cid: postB.cidStr,
          },
        },
        { headers: sc.getHeaders(sc.dids.carol), encoding: 'application/json' },
      )
      expect(forSnapshot([reportA, reportB])).toMatchSnapshot()
    })

    it("fails reporting a record that doesn't exist.", async () => {
      const postA = sc.posts[sc.dids.bob][0].ref
      const postB = sc.posts[sc.dids.bob][1].ref
      const postUriBad = new AtUri(postA.uriStr)
      postUriBad.rkey = 'badrkey'

      const promiseA = agent.api.com.atproto.report.create(
        {
          reasonType: SPAM,
          subject: {
            $type: 'com.atproto.repo.recordRef',
            uri: postUriBad.toString(),
          },
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )
      await expect(promiseA).rejects.toThrow('Record not found')

      const promiseB = agent.api.com.atproto.report.create(
        {
          reasonType: OTHER,
          reason: 'defamation',
          subject: {
            $type: 'com.atproto.repo.recordRef',
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
      const { data: reportA } = await agent.api.com.atproto.report.create(
        {
          reasonType: SPAM,
          subject: {
            $type: 'com.atproto.repo.repoRef',
            did: sc.dids.bob,
          },
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )
      const post = sc.posts[sc.dids.bob][1].ref
      const { data: reportB } = await agent.api.com.atproto.report.create(
        {
          reasonType: OTHER,
          reason: 'defamation',
          subject: {
            $type: 'com.atproto.repo.recordRef',
            uri: post.uri.toString(),
          },
        },
        { headers: sc.getHeaders(sc.dids.carol), encoding: 'application/json' },
      )
      const { data: action } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: TAKEDOWN,
            subject: {
              $type: 'com.atproto.repo.repoRef',
              did: sc.dids.bob,
            },
            createdBy: 'X',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        )
      const { data: actionResolvedReports } =
        await agent.api.com.atproto.admin.resolveModerationReports(
          {
            actionId: action.id,
            reportIds: [reportB.id, reportA.id],
            createdBy: 'X',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        )

      expect(forSnapshot(actionResolvedReports)).toMatchSnapshot()

      // Cleanup
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: action.id,
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
    })

    it('does not resolve report for mismatching repo.', async () => {
      const { data: report } = await agent.api.com.atproto.report.create(
        {
          reasonType: SPAM,
          subject: {
            $type: 'com.atproto.repo.repoRef',
            did: sc.dids.bob,
          },
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )
      const { data: action } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: TAKEDOWN,
            subject: {
              $type: 'com.atproto.repo.repoRef',
              did: sc.dids.carol,
            },
            createdBy: 'X',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        )

      const promise = agent.api.com.atproto.admin.resolveModerationReports(
        {
          actionId: action.id,
          reportIds: [report.id],
          createdBy: 'X',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

      await expect(promise).rejects.toThrow(
        'Report 7 cannot be resolved by action',
      )

      // Cleanup
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: action.id,
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
    })

    it('does not resolve report for mismatching record.', async () => {
      const postUri1 = sc.posts[sc.dids.alice][0].ref.uri
      const postUri2 = sc.posts[sc.dids.bob][0].ref.uri
      const { data: report } = await agent.api.com.atproto.report.create(
        {
          reasonType: SPAM,
          subject: {
            $type: 'com.atproto.repo.recordRef',
            uri: postUri1.toString(),
          },
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )
      const { data: action } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: TAKEDOWN,
            subject: {
              $type: 'com.atproto.repo.recordRef',
              uri: postUri2.toString(),
            },
            createdBy: 'X',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        )

      const promise = agent.api.com.atproto.admin.resolveModerationReports(
        {
          actionId: action.id,
          reportIds: [report.id],
          createdBy: 'X',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

      await expect(promise).rejects.toThrow(
        'Report 8 cannot be resolved by action',
      )

      // Cleanup
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: action.id,
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
    })

    it('supports flagging and acknowledging.', async () => {
      const postRef1 = sc.posts[sc.dids.alice][0].ref
      const postRef2 = sc.posts[sc.dids.bob][0].ref
      const { data: action1 } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: FLAG,
            subject: {
              $type: 'com.atproto.repo.recordRef',
              uri: postRef1.uri.toString(),
            },
            createdBy: 'X',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        )
      expect(action1).toEqual(
        expect.objectContaining({
          action: FLAG,
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
              $type: 'com.atproto.repo.recordRef',
              uri: postRef2.uri.toString(),
            },
            createdBy: 'X',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
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
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: action2.id,
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
    })

    it('only allows record to have one current action.', async () => {
      const postUri = sc.posts[sc.dids.alice][0].ref.uri
      const { data: acknowledge } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: ACKNOWLEDGE,
            subject: {
              $type: 'com.atproto.repo.recordRef',
              uri: postUri.toString(),
            },
            createdBy: 'X',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        )
      const flagPromise = agent.api.com.atproto.admin.takeModerationAction(
        {
          action: FLAG,
          subject: {
            $type: 'com.atproto.repo.recordRef',
            uri: postUri.toString(),
          },
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
      await expect(flagPromise).rejects.toThrow(
        'Subject already has an active action:',
      )

      // Reverse current then retry
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: acknowledge.id,
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
      const { data: flag } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: FLAG,
            subject: {
              $type: 'com.atproto.repo.recordRef',
              uri: postUri.toString(),
            },
            createdBy: 'X',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        )

      // Cleanup
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: flag.id,
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
    })

    it('only allows repo to have one current action.', async () => {
      const { data: acknowledge } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: ACKNOWLEDGE,
            subject: {
              $type: 'com.atproto.repo.repoRef',
              did: sc.dids.alice,
            },
            createdBy: 'X',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        )
      const flagPromise = agent.api.com.atproto.admin.takeModerationAction(
        {
          action: FLAG,
          subject: {
            $type: 'com.atproto.repo.repoRef',
            did: sc.dids.alice,
          },
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
      await expect(flagPromise).rejects.toThrow(
        'Subject already has an active action:',
      )

      // Reverse current then retry
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: acknowledge.id,
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
      const { data: flag } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: FLAG,
            subject: {
              $type: 'com.atproto.repo.repoRef',
              did: sc.dids.alice,
            },
            createdBy: 'X',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        )

      // Cleanup
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: flag.id,
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
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
              $type: 'com.atproto.repo.recordRef',
              uri: postA.ref.uriStr,
            },
            subjectBlobCids: [img.image.cid],
            createdBy: 'X',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        )
      const flagPromise = agent.api.com.atproto.admin.takeModerationAction(
        {
          action: FLAG,
          subject: {
            $type: 'com.atproto.repo.recordRef',
            uri: postB.ref.uriStr,
          },
          subjectBlobCids: [img.image.cid],
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
      await expect(flagPromise).rejects.toThrow(
        'Blob already has an active action:',
      )
      // Reverse current then retry
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: acknowledge.id,
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
      const { data: flag } =
        await agent.api.com.atproto.admin.takeModerationAction(
          {
            action: FLAG,
            subject: {
              $type: 'com.atproto.repo.recordRef',
              uri: postB.ref.uriStr,
            },
            subjectBlobCids: [img.image.cid],
            createdBy: 'X',
            reason: 'Y',
          },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth() },
          },
        )

      // Cleanup
      await agent.api.com.atproto.admin.reverseModerationAction(
        {
          id: flag.id,
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
    })
  })

  describe('blob takedown', () => {
    let post: { ref: RecordRef; images: ImageRef[] }
    let blob: ImageRef
    let imageUri: string
    let actionId: number
    beforeAll(async () => {
      post = sc.posts[sc.dids.carol][0]
      blob = post.images[1]
      imageUri = server.ctx.imgUriBuilder
        .getCommonSignedUri('feed_thumbnail', blob.image.cid)
        .replace(server.ctx.cfg.publicUrl, server.url)
      // Warm image server cache
      await fetch(imageUri)
      const cached = await fetch(imageUri)
      expect(cached.headers.get('x-cache')).toEqual('hit')
      const takeAction = await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.repo.recordRef',
            uri: post.ref.uriStr,
          },
          subjectBlobCids: [blob.image.cid],
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )
      actionId = takeAction.data.id
    })

    it('removes blob from the store', async () => {
      const tryGetBytes = server.ctx.blobstore.getBytes(
        CID.parse(blob.image.cid),
      )
      await expect(tryGetBytes).rejects.toThrow(BlobNotFoundError)
    })

    it('prevents blob from being referenced again.', async () => {
      const uploaded = await sc.uploadFile(
        sc.dids.alice,
        'tests/image/fixtures/key-alt.jpg',
        'image/jpeg',
      )
      expect(uploaded.image.cid).toEqual(blob.image.cid)
      const referenceBlob = sc.post(sc.dids.alice, 'pic', [], [blob])
      await expect(referenceBlob).rejects.toThrow('Could not find blob:')
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
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

      // Can post and reference blob
      const post = await sc.post(sc.dids.alice, 'pic', [], [blob])
      expect(post.images[0].image.cid).toEqual(blob.image.cid)

      // Can fetch through image server
      const fetchImage = await fetch(imageUri)
      expect(fetchImage.status).toEqual(200)
      const size = Number(fetchImage.headers.get('content-length'))
      expect(size).toBeGreaterThan(9000)
    })
  })
})
