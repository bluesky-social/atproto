import assert from 'node:assert'
import { AtpAgent } from '@atproto/api'
import { ImageRef, SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import {
  RepoBlobRef,
  RepoRef,
  isRepoBlobRef,
  isRepoRef,
} from '../../src/lexicon/types/com/atproto/admin/defs'
import {
  Main as StrongRef,
  isMain as isStrongRef,
} from '../../src/lexicon/types/com/atproto/repo/strongRef'
import { $Typed } from '../../src/lexicon/util'

describe('moderation', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  let repoSubject: $Typed<RepoRef>
  let recordSubject: $Typed<StrongRef>
  let blobSubject: $Typed<RepoBlobRef>
  let blobRef: ImageRef

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_moderation',
    })

    agent = network.bsky.getClient()
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
        headers: network.bsky.adminAuthHeaders(),
      },
    )
    const res = await agent.api.com.atproto.admin.getSubjectStatus(
      {
        did: repoSubject.did,
      },
      { headers: network.bsky.adminAuthHeaders() },
    )
    assert(isRepoRef(res.data.subject))
    expect(res.data.subject.did).toEqual(sc.dids.bob)
    expect(res.data.takedown?.applied).toBe(true)
    // expect(res.data.takedown?.ref).toBe('test-repo') @TODO add these checks back in once takedown refs make it into dataplane
  })

  it('restores takendown accounts', async () => {
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject: repoSubject,
        takedown: { applied: false },
      },
      {
        encoding: 'application/json',
        headers: network.bsky.adminAuthHeaders(),
      },
    )
    const res = await agent.api.com.atproto.admin.getSubjectStatus(
      {
        did: repoSubject.did,
      },
      { headers: network.bsky.adminAuthHeaders() },
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
        headers: network.bsky.adminAuthHeaders(),
      },
    )
    const res = await agent.api.com.atproto.admin.getSubjectStatus(
      {
        uri: recordSubject.uri,
      },
      { headers: network.bsky.adminAuthHeaders() },
    )
    assert(isStrongRef(res.data.subject))
    expect(res.data.subject.uri).toEqual(recordSubject.uri)
    expect(res.data.takedown?.applied).toBe(true)
    // expect(res.data.takedown?.ref).toBe('test-record')
  })

  it('restores takendown records', async () => {
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject: recordSubject,
        takedown: { applied: false },
      },
      {
        encoding: 'application/json',
        headers: network.bsky.adminAuthHeaders(),
      },
    )
    const res = await agent.api.com.atproto.admin.getSubjectStatus(
      {
        uri: recordSubject.uri,
      },
      { headers: network.bsky.adminAuthHeaders() },
    )
    assert(isStrongRef(res.data.subject))
    expect(res.data.subject.uri).toEqual(recordSubject.uri)
    expect(res.data.takedown?.applied).toBe(false)
    expect(res.data.takedown?.ref).toBeUndefined()
  })

  describe('blob takedown', () => {
    let blobUri: string
    let imageUri: string

    beforeAll(async () => {
      blobUri = `${network.bsky.url}/blob/${blobSubject.did}/${blobSubject.cid}`
      imageUri = network.bsky.ctx.views.imgUriBuilder
        .getPresetUri('feed_thumbnail', blobSubject.did, blobSubject.cid)
        .replace(network.bsky.ctx.cfg.publicUrl || '', network.bsky.url)
      // Warm image server cache
      await fetch(imageUri)
      const cached = await fetch(imageUri)
      expect(cached.headers.get('x-cache')).toEqual('hit')
    })

    it('takes down blobs', async () => {
      await agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: blobSubject,
          takedown: { applied: true, ref: 'test-blob' },
        },
        {
          encoding: 'application/json',
          headers: network.bsky.adminAuthHeaders(),
        },
      )
      const res = await agent.api.com.atproto.admin.getSubjectStatus(
        {
          did: blobSubject.did,
          blob: blobSubject.cid,
        },
        { headers: network.bsky.adminAuthHeaders() },
      )
      assert(isRepoBlobRef(res.data.subject))
      expect(res.data.subject.did).toEqual(blobSubject.did)
      expect(res.data.subject.cid).toEqual(blobSubject.cid)
      expect(res.data.takedown?.applied).toBe(true)
      // expect(res.data.takedown?.ref).toBe('test-blob')
    })

    it('prevents resolution of blob', async () => {
      const resolveBlob = await fetch(blobUri)
      expect(resolveBlob.status).toEqual(404)
      expect(await resolveBlob.json()).toEqual({
        error: 'NotFoundError',
        message: 'Blob not found',
      })
    })

    it('restores blob when takedown is removed', async () => {
      await agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: blobSubject,
          takedown: { applied: false },
        },
        {
          encoding: 'application/json',
          headers: network.bsky.adminAuthHeaders(),
        },
      )

      // Can resolve blob
      const resolveBlob = await fetch(blobUri)
      expect(resolveBlob.status).toEqual(200)

      // Can fetch through image server
      const fetchImage = await fetch(imageUri)
      expect(fetchImage.status).toEqual(200)
      const size = Number(fetchImage.headers.get('content-length'))
      expect(size).toBeGreaterThan(9000)
    })
  })
})
