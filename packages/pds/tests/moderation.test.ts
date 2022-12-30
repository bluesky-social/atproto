import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import {
  adminAuth,
  CloseFn,
  forSnapshot,
  runTestServer,
  TestServerInfo,
} from './_util'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import { TAKEDOWN } from '../src/lexicon/types/com/atproto/admin/moderationAction'

describe('moderation', () => {
  let server: TestServerInfo
  let close: CloseFn
  let client: AtpServiceClient
  let sc: SeedClient

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'moderation',
    })
    close = server.close
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc)
  })

  afterAll(async () => {
    await close()
  })

  describe('reporting', () => {
    it('creates reports of a repo.', async () => {
      const { data: reportA } = await client.com.atproto.repo.report(
        {
          reasonType: 'com.atproto.repo.report#spam',
          subject: {
            $type: 'com.atproto.repo.report#subjectRepo',
            did: sc.dids.bob,
          },
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )
      const { data: reportB } = await client.com.atproto.repo.report(
        {
          reasonType: 'com.atproto.repo.report#other',
          reason: 'impersonation',
          subject: {
            $type: 'com.atproto.repo.report#subjectRepo',
            did: sc.dids.bob,
          },
        },
        { headers: sc.getHeaders(sc.dids.carol), encoding: 'application/json' },
      )
      expect(forSnapshot([reportA, reportB])).toMatchSnapshot()
    })

    it("fails reporting a repo that doesn't exist.", async () => {
      const promise = client.com.atproto.repo.report(
        {
          reasonType: 'com.atproto.repo.report#spam',
          subject: {
            $type: 'com.atproto.repo.report#subjectRepo',
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
      const { data: reportA } = await client.com.atproto.repo.report(
        {
          reasonType: 'com.atproto.repo.report#spam',
          subject: {
            $type: 'com.atproto.repo.report#subjectRecord',
            did: postA.uri.host,
            collection: postA.uri.collection,
            rkey: postA.uri.rkey,
          },
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )
      const { data: reportB } = await client.com.atproto.repo.report(
        {
          reasonType: 'com.atproto.repo.report#other',
          reason: 'defamation',
          subject: {
            $type: 'com.atproto.repo.report#subjectRecord',
            did: postB.uri.host,
            collection: postB.uri.collection,
            rkey: postB.uri.rkey,
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

      const promiseA = client.com.atproto.repo.report(
        {
          reasonType: 'com.atproto.repo.report#spam',
          subject: {
            $type: 'com.atproto.repo.report#subjectRecord',
            did: postA.uri.host,
            collection: postA.uri.collection,
            rkey: 'badrkey',
          },
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )
      await expect(promiseA).rejects.toThrow('Record not found')

      const promiseB = client.com.atproto.repo.report(
        {
          reasonType: 'com.atproto.repo.report#other',
          reason: 'defamation',
          subject: {
            $type: 'com.atproto.repo.report#subjectRecord',
            did: postB.uri.host,
            collection: postB.uri.collection,
            rkey: postB.uri.rkey,
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
      const { data: reportA } = await client.com.atproto.repo.report(
        {
          reasonType: 'com.atproto.repo.report#spam',
          subject: {
            $type: 'com.atproto.repo.report#subjectRepo',
            did: sc.dids.bob,
          },
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )
      const post = sc.posts[sc.dids.bob][1].ref
      const { data: reportB } = await client.com.atproto.repo.report(
        {
          reasonType: 'com.atproto.repo.report#other',
          reason: 'defamation',
          subject: {
            $type: 'com.atproto.repo.report#subjectRecord',
            did: post.uri.host,
            collection: post.uri.collection,
            rkey: post.uri.rkey,
          },
        },
        { headers: sc.getHeaders(sc.dids.carol), encoding: 'application/json' },
      )
      const { data: action } =
        await client.com.atproto.admin.takeModerationAction(
          {
            action: TAKEDOWN,
            subject: {
              $type: 'com.atproto.admin.moderationAction#subjectRepo',
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
        await client.com.atproto.admin.resolveModerationReports(
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
      await client.com.atproto.admin.reverseModerationAction(
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
      const { data: report } = await client.com.atproto.repo.report(
        {
          reasonType: 'com.atproto.repo.report#spam',
          subject: {
            $type: 'com.atproto.repo.report#subjectRepo',
            did: sc.dids.bob,
          },
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )
      const { data: action } =
        await client.com.atproto.admin.takeModerationAction(
          {
            action: TAKEDOWN,
            subject: {
              $type: 'com.atproto.admin.moderationAction#subjectRepo',
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

      const promise = client.com.atproto.admin.resolveModerationReports(
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
      await client.com.atproto.admin.reverseModerationAction(
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
  })
})
