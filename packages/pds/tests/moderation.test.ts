import assert from 'node:assert'
import { AtpAgent } from '@atproto/api'
import { ImageRef, SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { BlobNotFoundError } from '@atproto/repo'
import {
  RepoBlobRef,
  RepoRef,
  isRepoBlobRef,
  isRepoRef,
} from '../src/lexicon/types/com/atproto/admin/defs'
import {
  Main as StrongRef,
  isMain as isStrongRef,
} from '../src/lexicon/types/com/atproto/repo/strongRef'
import { $Typed } from '../src/lexicon/util'
import basicSeed from './seeds/basic'

describe('moderation', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  let repoSubject: $Typed<RepoRef>
  let recordSubject: $Typed<StrongRef>
  let blobSubject: $Typed<RepoBlobRef>
  let blobRef: ImageRef

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'moderation',
    })

    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    repoSubject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.bob,
    }
    const post = sc.posts[sc.dids.carol][0]
    recordSubject = {
      $type: 'com.atproto.repo.strongRef',
      uri: post.ref.uriStr,
      cid: post.ref.cidStr,
    }
    blobRef = post.images[1]
    blobSubject = {
      $type: 'com.atproto.admin.defs#repoBlobRef',
      did: sc.dids.carol,
      cid: blobRef.image.ref.toString(),
    }
  })

  afterAll(async () => {
    await network.close()
  })

  it('takes down accounts', async () => {
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject: repoSubject,
        takedown: { applied: true, ref: 'test-repo' },
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )
    const res = await agent.api.com.atproto.admin.getSubjectStatus(
      {
        did: repoSubject.did,
      },
      { headers: network.pds.adminAuthHeaders() },
    )
    assert(isRepoRef(res.data.subject))
    expect(res.data.subject.did).toEqual(sc.dids.bob)
    expect(res.data.takedown?.applied).toBe(true)
    expect(res.data.takedown?.ref).toBe('test-repo')
  })

  it('restores takendown accounts', async () => {
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject: repoSubject,
        takedown: { applied: false },
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )
    const res = await agent.api.com.atproto.admin.getSubjectStatus(
      {
        did: repoSubject.did,
      },
      { headers: network.pds.adminAuthHeaders() },
    )
    assert(isRepoRef(res.data.subject))
    expect(res.data.subject.did).toEqual(sc.dids.bob)
    expect(res.data.takedown?.applied).toBe(false)
    expect(res.data.takedown?.ref).toBeUndefined()
  })

  it('takes down records', async () => {
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject: recordSubject,
        takedown: { applied: true, ref: 'test-record' },
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )
    const res = await agent.api.com.atproto.admin.getSubjectStatus(
      {
        uri: recordSubject.uri,
      },
      { headers: network.pds.adminAuthHeaders() },
    )
    assert(isStrongRef(res.data.subject))
    expect(res.data.subject.uri).toEqual(recordSubject.uri)
    expect(res.data.takedown?.applied).toBe(true)
    expect(res.data.takedown?.ref).toBe('test-record')
  })

  it('restores takendown records', async () => {
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject: recordSubject,
        takedown: { applied: false },
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )
    const res = await agent.api.com.atproto.admin.getSubjectStatus(
      {
        uri: recordSubject.uri,
      },
      { headers: network.pds.adminAuthHeaders() },
    )
    assert(isStrongRef(res.data.subject))
    expect(res.data.subject.uri).toEqual(recordSubject.uri)
    expect(res.data.takedown?.applied).toBe(false)
    expect(res.data.takedown?.ref).toBeUndefined()
  })

  describe('blob takedown', () => {
    it('takes down blobs', async () => {
      await agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: blobSubject,
          takedown: { applied: true, ref: 'test-blob' },
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
      const res = await agent.api.com.atproto.admin.getSubjectStatus(
        {
          did: blobSubject.did,
          blob: blobSubject.cid,
        },
        { headers: network.pds.adminAuthHeaders() },
      )
      assert(isRepoBlobRef(res.data.subject))
      expect(res.data.subject.did).toEqual(blobSubject.did)
      assert(isRepoBlobRef(res.data.subject))
      expect(res.data.subject.cid).toEqual(blobSubject.cid)
      expect(res.data.takedown?.applied).toBe(true)
      expect(res.data.takedown?.ref).toBe('test-blob')
    })

    it('removes blob from the store', async () => {
      const tryGetBytes = network.pds.ctx
        .blobstore(blobSubject.did)
        .getBytes(blobRef.image.ref)
      await expect(tryGetBytes).rejects.toThrow(BlobNotFoundError)
    })

    it('prevents blob from being referenced again.', async () => {
      const referenceBlob = sc.post(sc.dids.carol, 'pic', [], [blobRef])
      await expect(referenceBlob).rejects.toThrow('Could not find blob:')
    })

    it('prevents blob from being reuploaded', async () => {
      const attempt = sc.uploadFile(
        sc.dids.carol,
        '../dev-env/assets/key-alt.jpg',
        'image/jpeg',
      )
      await expect(attempt).rejects.toThrow(
        'Blob has been takendown, cannot re-upload',
      )
    })

    it('prevents image blob from being served.', async () => {
      const attempt = agent.api.com.atproto.sync.getBlob({
        did: sc.dids.carol,
        cid: blobRef.image.ref.toString(),
      })
      await expect(attempt).rejects.toThrow('Blob not found')
    })

    it('restores blob when takedown is removed', async () => {
      await agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: blobSubject,
          takedown: { applied: false },
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )

      // Can post and reference blob
      const post = await sc.post(sc.dids.carol, 'pic', [], [blobRef])
      expect(post.images[0].image.ref.equals(blobRef.image.ref)).toBeTruthy()

      // Can fetch through image server
      const res = await agent.api.com.atproto.sync.getBlob({
        did: sc.dids.carol,
        cid: blobRef.image.ref.toString(),
      })

      expect(res.data.byteLength).toBeGreaterThan(9000)
    })

    it('prevents blobs of takendown accounts from being served.', async () => {
      await agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.carol,
          },
          takedown: { applied: true },
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
      const blobParams = {
        did: sc.dids.carol,
        cid: blobRef.image.ref.toString(),
      }
      // public, disallow
      const attempt1 = agent.api.com.atproto.sync.getBlob(blobParams)
      await expect(attempt1).rejects.toThrow(/Repo has been takendown/)
      // logged-in, disallow
      const attempt2 = agent.api.com.atproto.sync.getBlob(blobParams, {
        headers: sc.getHeaders(sc.dids.bob),
      })
      await expect(attempt2).rejects.toThrow(/Repo has been takendown/)
      // logged-in as account, allow
      const res1 = await agent.api.com.atproto.sync.getBlob(blobParams, {
        headers: sc.getHeaders(sc.dids.carol),
      })
      expect(res1.data.byteLength).toBeGreaterThan(9000)
      // admin role, allow
      const res2 = await agent.api.com.atproto.sync.getBlob(blobParams, {
        headers: network.pds.adminAuthHeaders(),
      })
      expect(res2.data.byteLength).toBeGreaterThan(9000)
      // revert takedown
      await agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.carol,
          },
          takedown: { applied: false },
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
    })
  })
})
