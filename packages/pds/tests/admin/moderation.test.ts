import {
  TestNetworkNoAppView,
  ImageRef,
  RecordRef,
  SeedClient,
} from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { BlobNotFoundError } from '@atproto/repo'
import basicSeed from '../seeds/basic'
import {
  RepoBlobRef,
  RepoRef,
} from '../../src/lexicon/types/com/atproto/admin/defs'

describe('moderation', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'moderation',
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
  })

  afterAll(async () => {
    await network.close()
  })

  it('takes down accounts', async () => {
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.bob,
    }

    await agent.api.com.atproto.admin.updateSubjectState(
      {
        subject,
        takedown: { applied: true, ref: 'test' },
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders('moderator'),
      },
    )
    const res = await agent.api.com.atproto.admin.getSubjectState(
      {
        did: subject.did,
      },
      { headers: network.pds.adminAuthHeaders('moderator') },
    )
    expect(res.data.subject.did).toEqual(sc.dids.bob)
    expect(res.data.takedown?.applied).toBe(true)
    expect(res.data.takedown?.ref).toBe('test')
  })

  it('restores takendown accounts', async () => {
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.bob,
    }

    await agent.api.com.atproto.admin.updateSubjectState(
      {
        subject,
        takedown: { applied: false },
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders('moderator'),
      },
    )
    const res = await agent.api.com.atproto.admin.getSubjectState(
      {
        did: subject.did,
      },
      { headers: network.pds.adminAuthHeaders('moderator') },
    )
    expect(res.data.subject.did).toEqual(sc.dids.bob)
    expect(res.data.takedown?.applied).toBe(false)
    expect(res.data.takedown?.ref).toBeUndefined()
  })

  it('does not allow non-full moderators to update subject state', async () => {
    const subject = {
      $type: 'com.atproto.admin.defs#repoRef',
      did: sc.dids.bob,
    }
    const attemptTakedownTriage =
      agent.api.com.atproto.admin.updateSubjectState(
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
    const res = await agent.api.com.atproto.admin.getSubjectState(
      {
        did: subject.did,
      },
      { headers: network.pds.adminAuthHeaders('moderator') },
    )
    expect(res.data.takedown?.applied).toBe(false)
  })

  describe('blob takedown', () => {
    let post: { ref: RecordRef; images: ImageRef[] }
    let blob: ImageRef
    let subject: RepoBlobRef

    beforeAll(async () => {
      post = sc.posts[sc.dids.carol][0]
      blob = post.images[1]
      subject = {
        $type: 'com.atproto.admin.defs#repoBlobRef',
        did: sc.dids.carol,
        cid: blob.image.ref.toString(),
      }
      await agent.api.com.atproto.admin.updateSubjectState(
        {
          subject,
          takedown: { applied: true },
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )
    })

    it('removes blob from the store', async () => {
      const tryGetBytes = network.pds.ctx.blobstore.getBytes(blob.image.ref)
      await expect(tryGetBytes).rejects.toThrow(BlobNotFoundError)
    })

    it('prevents blob from being referenced again.', async () => {
      const uploaded = await sc.uploadFile(
        sc.dids.alice,
        'tests/sample-img/key-alt.jpg',
        'image/jpeg',
      )
      expect(uploaded.image.ref.equals(blob.image.ref)).toBeTruthy()
      const referenceBlob = sc.post(sc.dids.alice, 'pic', [], [blob])
      await expect(referenceBlob).rejects.toThrow('Could not find blob:')
    })

    it('prevents image blob from being served, even when cached.', async () => {
      const attempt = agent.api.com.atproto.sync.getBlob({
        did: sc.dids.carol,
        cid: blob.image.ref.toString(),
      })
      await expect(attempt).rejects.toThrow('Blob not found')
    })

    it('restores blob when takedown is removed', async () => {
      await agent.api.com.atproto.admin.updateSubjectState(
        {
          subject,
          takedown: { applied: false },
        },
        {
          encoding: 'application/json',
          headers: network.pds.adminAuthHeaders(),
        },
      )

      // Can post and reference blob
      const post = await sc.post(sc.dids.alice, 'pic', [], [blob])
      expect(post.images[0].image.ref.equals(blob.image.ref)).toBeTruthy()

      // Can fetch through image server
      const res = await agent.api.com.atproto.sync.getBlob({
        did: sc.dids.carol,
        cid: blob.image.ref.toString(),
      })

      expect(res.data.byteLength).toBeGreaterThan(9000)
    })
  })
})
