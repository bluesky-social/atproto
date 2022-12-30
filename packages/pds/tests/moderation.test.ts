import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { CloseFn, forSnapshot, runTestServer, TestServerInfo } from './_util'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'

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
})
