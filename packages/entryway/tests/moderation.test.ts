import { TestNetworkNoAppView, ImageRef, SeedClient } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { BlobNotFoundError } from '@atproto/repo'
import { Secp256k1Keypair } from '@atproto/crypto'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import basicSeed from './seeds/basic'
import {
  RepoBlobRef,
  RepoRef,
} from '../src/lexicon/types/com/atproto/admin/defs'
import { Main as StrongRef } from '../src/lexicon/types/com/atproto/repo/strongRef'

describe('moderation', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  let repoSubject: RepoRef
  let recordSubject: StrongRef
  let blobSubject: RepoBlobRef
  let blobRef: ImageRef

  const appviewDid = 'did:example:appview'
  const altAppviewDid = 'did:example:alt'
  let appviewKey: Secp256k1Keypair

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'moderation',
      pds: {
        bskyAppViewDid: appviewDid,
      },
    })

    appviewKey = await Secp256k1Keypair.create()
    const origResolve = network.pds.ctx.idResolver.did.resolveAtprotoKey
    network.pds.ctx.idResolver.did.resolveAtprotoKey = async (
      did: string,
      forceRefresh?: boolean,
    ) => {
      if (did === appviewDid || did === altAppviewDid) {
        return appviewKey.did()
      }
      return origResolve(did, forceRefresh)
    }

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
        headers: network.pds.adminAuthHeaders('moderator'),
      },
    )
    const res = await agent.api.com.atproto.admin.getSubjectStatus(
      {
        did: repoSubject.did,
      },
      { headers: network.pds.adminAuthHeaders('moderator') },
    )
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
        headers: network.pds.adminAuthHeaders('moderator'),
      },
    )
    const res = await agent.api.com.atproto.admin.getSubjectStatus(
      {
        did: repoSubject.did,
      },
      { headers: network.pds.adminAuthHeaders('moderator') },
    )
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
        headers: network.pds.adminAuthHeaders('moderator'),
      },
    )
    const res = await agent.api.com.atproto.admin.getSubjectStatus(
      {
        uri: recordSubject.uri,
      },
      { headers: network.pds.adminAuthHeaders('moderator') },
    )
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
        headers: network.pds.adminAuthHeaders('moderator'),
      },
    )
    const res = await agent.api.com.atproto.admin.getSubjectStatus(
      {
        uri: recordSubject.uri,
      },
      { headers: network.pds.adminAuthHeaders('moderator') },
    )
    expect(res.data.subject.uri).toEqual(recordSubject.uri)
    expect(res.data.takedown?.applied).toBe(false)
    expect(res.data.takedown?.ref).toBeUndefined()
  })

  it('does not allow non-full moderators to update subject state', async () => {
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.bob,
    }
    const attemptTakedownTriage =
      agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject,
          takedown: { applied: true },
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders('triage'),
        },
      )
    await expect(attemptTakedownTriage).rejects.toThrow(
      'Must be a full moderator to update subject state',
    )
    const res = await agent.api.com.atproto.admin.getSubjectStatus(
      {
        did: subject.did,
      },
      { headers: network.pds.adminAuthHeaders('moderator') },
    )
    expect(res.data.takedown?.applied).toBe(false)
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
        { headers: network.pds.adminAuthHeaders('moderator') },
      )
      expect(res.data.subject.did).toEqual(blobSubject.did)
      expect(res.data.subject.cid).toEqual(blobSubject.cid)
      expect(res.data.takedown?.applied).toBe(true)
      expect(res.data.takedown?.ref).toBe('test-blob')
    })

    it('removes blob from the store', async () => {
      const tryGetBytes = network.pds.ctx.blobstore.getBytes(blobRef.image.ref)
      await expect(tryGetBytes).rejects.toThrow(BlobNotFoundError)
    })

    it('prevents blob from being referenced again.', async () => {
      const uploaded = await sc.uploadFile(
        sc.dids.alice,
        'tests/sample-img/key-alt.jpg',
        'image/jpeg',
      )
      expect(uploaded.image.ref.equals(blobRef.image.ref)).toBeTruthy()
      const referenceBlob = sc.post(sc.dids.alice, 'pic', [], [blobRef])
      await expect(referenceBlob).rejects.toThrow('Could not find blob:')
    })

    it('prevents image blob from being served, even when cached.', async () => {
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
      const post = await sc.post(sc.dids.alice, 'pic', [], [blobRef])
      expect(post.images[0].image.ref.equals(blobRef.image.ref)).toBeTruthy()

      // Can fetch through image server
      const res = await agent.api.com.atproto.sync.getBlob({
        did: sc.dids.carol,
        cid: blobRef.image.ref.toString(),
      })

      expect(res.data.byteLength).toBeGreaterThan(9000)
    })
  })

  describe('auth', () => {
    it('allows service auth requests from the configured appview did', async () => {
      const headers = await createServiceAuthHeaders({
        iss: appviewDid,
        aud: repoSubject.did,
        keypair: appviewKey,
      })
      await agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: repoSubject,
          takedown: { applied: true, ref: 'test-repo' },
        },
        {
          ...headers,
          encoding: 'application/json',
        },
      )

      const res = await agent.api.com.atproto.admin.getSubjectStatus(
        {
          did: repoSubject.did,
        },
        headers,
      )
      expect(res.data.subject.did).toBe(repoSubject.did)
      expect(res.data.takedown?.applied).toBe(true)
    })

    it('does not allow requests from another did', async () => {
      const headers = await createServiceAuthHeaders({
        iss: altAppviewDid,
        aud: repoSubject.did,
        keypair: appviewKey,
      })
      const attempt = agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: repoSubject,
          takedown: { applied: true, ref: 'test-repo' },
        },
        {
          ...headers,
          encoding: 'application/json',
        },
      )
      await expect(attempt).rejects.toThrow(
        'Untrusted issuer for admin actions',
      )
    })

    it('does not allow requests with a bad signature', async () => {
      const badKey = await Secp256k1Keypair.create()
      const headers = await createServiceAuthHeaders({
        iss: appviewDid,
        aud: repoSubject.did,
        keypair: badKey,
      })
      const attempt = agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: repoSubject,
          takedown: { applied: true, ref: 'test-repo' },
        },
        {
          ...headers,
          encoding: 'application/json',
        },
      )
      await expect(attempt).rejects.toThrow(
        'jwt signature does not match jwt issuer',
      )
    })

    it('does not allow requests with a bad signature', async () => {
      // repo subject is bob, so we set alice as the audience
      const headers = await createServiceAuthHeaders({
        iss: appviewDid,
        aud: sc.dids.alice,
        keypair: appviewKey,
      })
      const attempt = agent.api.com.atproto.admin.updateSubjectStatus(
        {
          subject: repoSubject,
          takedown: { applied: true, ref: 'test-repo' },
        },
        {
          ...headers,
          encoding: 'application/json',
        },
      )
      await expect(attempt).rejects.toThrow(
        'jwt audience does not match account did',
      )
    })
  })
})
