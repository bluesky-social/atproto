import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Secp256k1Keypair } from '@atproto/crypto'
import {
  MemoryRepoStorage,
  RecordAlreadyExistsError,
  RecordNotFoundError,
  SpaceContext,
  SpaceRepo,
  WriteOpAction,
  createClientAttestation,
  createDelegationToken,
  createSpaceCredential,
  parseClientAttestation,
  verifyDelegationToken,
  verifySpaceCredential,
} from '../src/index.js'

const testSpace: SpaceContext = {
  space: 'at://did:example:space/space/app.bsky.group/test',
  author: 'did:example:alice',
  rev: '3kbcq3p7ad400',
}

describe('SpaceRepo', () => {
  let repo: SpaceRepo

  beforeEach(() => {
    const storage = new MemoryRepoStorage()
    repo = SpaceRepo.create(storage, 'did:example:alice')
  })

  describe('formatCommit + applyCommit', () => {
    it('creates a record', async () => {
      const commit = await repo.formatCommit({
        action: WriteOpAction.Create,
        collection: 'app.bsky.feed.post',
        rkey: '1',
        record: { text: 'hello' },
      })
      expect(commit.writes).toHaveLength(1)
      expect(commit.writes[0].action).toBe(WriteOpAction.Create)
      expect(commit.writes[0]).toHaveProperty('cid')

      // not persisted yet
      expect(await repo.getRecord('app.bsky.feed.post', '1')).toBeNull()

      await repo.applyCommit(commit)
      const record = await repo.getRecord('app.bsky.feed.post', '1')
      expect(record).toEqual({ text: 'hello' })
    })

    it('updates a record', async () => {
      await repo.applyWrites({
        action: WriteOpAction.Create,
        collection: 'app.bsky.feed.post',
        rkey: '1',
        record: { text: 'hello' },
      })

      const commit = await repo.formatCommit({
        action: WriteOpAction.Update,
        collection: 'app.bsky.feed.post',
        rkey: '1',
        record: { text: 'updated' },
      })
      await repo.applyCommit(commit)

      const record = await repo.getRecord('app.bsky.feed.post', '1')
      expect(record).toEqual({ text: 'updated' })
    })

    it('deletes a record', async () => {
      await repo.applyWrites({
        action: WriteOpAction.Create,
        collection: 'app.bsky.feed.post',
        rkey: '1',
        record: { text: 'hello' },
      })

      const commit = await repo.formatCommit({
        action: WriteOpAction.Delete,
        collection: 'app.bsky.feed.post',
        rkey: '1',
      })
      await repo.applyCommit(commit)

      expect(await repo.getRecord('app.bsky.feed.post', '1')).toBeNull()
    })

    it('throws on duplicate create', async () => {
      await repo.applyWrites({
        action: WriteOpAction.Create,
        collection: 'app.bsky.feed.post',
        rkey: '1',
        record: { text: 'hello' },
      })
      await expect(
        repo.formatCommit({
          action: WriteOpAction.Create,
          collection: 'app.bsky.feed.post',
          rkey: '1',
          record: { text: 'dupe' },
        }),
      ).rejects.toThrow(RecordAlreadyExistsError)
    })

    it('throws on update of missing record', async () => {
      await expect(
        repo.formatCommit({
          action: WriteOpAction.Update,
          collection: 'app.bsky.feed.post',
          rkey: 'missing',
          record: { text: 'nope' },
        }),
      ).rejects.toThrow(RecordNotFoundError)
    })

    it('throws on delete of missing record', async () => {
      await expect(
        repo.formatCommit({
          action: WriteOpAction.Delete,
          collection: 'app.bsky.feed.post',
          rkey: 'missing',
        }),
      ).rejects.toThrow(RecordNotFoundError)
    })
  })

  describe('applyWrites (convenience)', () => {
    it('creates and reads a record', async () => {
      await repo.applyWrites({
        action: WriteOpAction.Create,
        collection: 'app.bsky.feed.post',
        rkey: '1',
        record: { text: 'hello' },
      })
      const record = await repo.getRecord('app.bsky.feed.post', '1')
      expect(record).toEqual({ text: 'hello' })
    })

    it('handles batch writes', async () => {
      await repo.applyWrites([
        {
          action: WriteOpAction.Create,
          collection: 'app.bsky.feed.post',
          rkey: '1',
          record: { text: 'first' },
        },
        {
          action: WriteOpAction.Create,
          collection: 'app.bsky.feed.post',
          rkey: '2',
          record: { text: 'second' },
        },
      ])
      const records = await repo.listRecords('app.bsky.feed.post')
      expect(records).toHaveLength(2)
    })
  })

  describe('enumeration', () => {
    it('lists collections', async () => {
      await repo.applyWrites([
        {
          action: WriteOpAction.Create,
          collection: 'app.bsky.feed.post',
          rkey: '1',
          record: { text: 'hello' },
        },
        {
          action: WriteOpAction.Create,
          collection: 'app.bsky.feed.like',
          rkey: '1',
          record: { subject: 'x' },
        },
      ])
      const collections = await repo.listCollections()
      expect(collections.sort()).toEqual([
        'app.bsky.feed.like',
        'app.bsky.feed.post',
      ])
    })

    it('lists records in a collection', async () => {
      await repo.applyWrites([
        {
          action: WriteOpAction.Create,
          collection: 'app.bsky.feed.post',
          rkey: '1',
          record: { text: 'first' },
        },
        {
          action: WriteOpAction.Create,
          collection: 'app.bsky.feed.post',
          rkey: '2',
          record: { text: 'second' },
        },
      ])
      const records = await repo.listRecords('app.bsky.feed.post')
      expect(records).toHaveLength(2)
      expect(records.map((r) => r.rkey).sort()).toEqual(['1', '2'])
    })
  })
})

describe('commits', () => {
  let repo: SpaceRepo
  let keypair: Secp256k1Keypair

  beforeAll(async () => {
    keypair = await Secp256k1Keypair.create()
  })

  beforeEach(() => {
    const storage = new MemoryRepoStorage()
    repo = SpaceRepo.create(storage, 'did:example:alice')
  })

  it('creates a valid signed commit', async () => {
    await repo.applyWrites({
      action: WriteOpAction.Create,
      collection: 'app.bsky.feed.post',
      rkey: '1',
      record: { text: 'hello' },
    })
    const commit = await repo.commit(testSpace, keypair)
    expect(commit.ver).toBe(1)
    expect(commit.hash).toBeInstanceOf(Buffer)
    expect(commit.mac).toBeInstanceOf(Buffer)
    expect(commit.ikm).toBeInstanceOf(Buffer)
    expect(commit.sig).toBeInstanceOf(Buffer)
    expect(commit.rev).toBe(testSpace.rev)
  })

  it('commit.hash equals setHash.digest() (32 bytes)', async () => {
    await repo.applyWrites({
      action: WriteOpAction.Create,
      collection: 'app.bsky.feed.post',
      rkey: '1',
      record: { text: 'hello' },
    })
    const commit = await repo.commit(testSpace, keypair)
    expect(commit.hash).toEqual(repo.setHash.digest())
    expect(commit.hash).toHaveLength(32)
  })

  it('produces different ikm per commit (deniability)', async () => {
    await repo.applyWrites({
      action: WriteOpAction.Create,
      collection: 'app.bsky.feed.post',
      rkey: '1',
      record: { text: 'hello' },
    })
    const c1 = await repo.commit(testSpace, keypair)
    const c2 = await repo.commit(testSpace, keypair)
    expect(c1.ikm).not.toEqual(c2.ikm)
    expect(c1.mac).not.toEqual(c2.mac)
    expect(c1.hash).toEqual(c2.hash)
  })

  it('repo verifies its own commit (mac)', async () => {
    await repo.applyWrites({
      action: WriteOpAction.Create,
      collection: 'app.bsky.feed.post',
      rkey: '1',
      record: { text: 'hello' },
    })
    const commit = await repo.commit(testSpace, keypair)
    expect(repo.verifyCommit(testSpace, commit)).toBe(true)
  })

  it('verifies the commit signature against the author key', async () => {
    await repo.applyWrites({
      action: WriteOpAction.Create,
      collection: 'app.bsky.feed.post',
      rkey: '1',
      record: { text: 'hello' },
    })
    const commit = await repo.commit(testSpace, keypair)
    expect(await repo.verifyCommitSig(testSpace, commit, keypair.did())).toBe(
      true,
    )
  })

  it('signature fails against a different key', async () => {
    const other = await Secp256k1Keypair.create()
    await repo.applyWrites({
      action: WriteOpAction.Create,
      collection: 'app.bsky.feed.post',
      rkey: '1',
      record: { text: 'hello' },
    })
    const commit = await repo.commit(testSpace, keypair)
    expect(await repo.verifyCommitSig(testSpace, commit, other.did())).toBe(
      false,
    )
  })

  it('mac does not verify under a different space context', async () => {
    await repo.applyWrites({
      action: WriteOpAction.Create,
      collection: 'app.bsky.feed.post',
      rkey: '1',
      record: { text: 'hello' },
    })
    const commit = await repo.commit(testSpace, keypair)
    const otherSpace: SpaceContext = {
      space: 'at://did:example:space/space/app.bsky.group/other',
      author: testSpace.author,
      rev: testSpace.rev,
    }
    expect(repo.verifyCommit(otherSpace, commit)).toBe(false)
  })

  it('commit does not verify after repo changes', async () => {
    await repo.applyWrites({
      action: WriteOpAction.Create,
      collection: 'app.bsky.feed.post',
      rkey: '1',
      record: { text: 'hello' },
    })
    const commit = await repo.commit(testSpace, keypair)
    await repo.applyWrites({
      action: WriteOpAction.Create,
      collection: 'app.bsky.feed.post',
      rkey: '2',
      record: { text: 'world' },
    })
    expect(repo.verifyCommit(testSpace, commit)).toBe(false)
  })

  it('two repos with same records produce same hash', async () => {
    const storage2 = new MemoryRepoStorage()
    const repo2 = SpaceRepo.create(storage2, 'did:example:bob')

    await repo.applyWrites([
      {
        action: WriteOpAction.Create,
        collection: 'app.bsky.feed.post',
        rkey: '1',
        record: { text: 'hello' },
      },
      {
        action: WriteOpAction.Create,
        collection: 'app.bsky.feed.post',
        rkey: '2',
        record: { text: 'world' },
      },
    ])

    // Add in different order
    await repo2.applyWrites([
      {
        action: WriteOpAction.Create,
        collection: 'app.bsky.feed.post',
        rkey: '2',
        record: { text: 'world' },
      },
      {
        action: WriteOpAction.Create,
        collection: 'app.bsky.feed.post',
        rkey: '1',
        record: { text: 'hello' },
      },
    ])

    const c1 = await repo.commit(testSpace, keypair)
    const c2 = await repo2.commit(testSpace, keypair)
    expect(c1.hash).toEqual(c2.hash)
  })

  it('update changes the hash correctly', async () => {
    await repo.applyWrites({
      action: WriteOpAction.Create,
      collection: 'app.bsky.feed.post',
      rkey: '1',
      record: { text: 'hello' },
    })
    const before = await repo.commit(testSpace, keypair)

    await repo.applyWrites({
      action: WriteOpAction.Update,
      collection: 'app.bsky.feed.post',
      rkey: '1',
      record: { text: 'updated' },
    })
    const after = await repo.commit(testSpace, keypair)

    expect(before.hash).not.toEqual(after.hash)
  })

  it('delete reverses add for set hash', async () => {
    const emptyHash = (await repo.commit(testSpace, keypair)).hash

    await repo.applyWrites({
      action: WriteOpAction.Create,
      collection: 'app.bsky.feed.post',
      rkey: '1',
      record: { text: 'hello' },
    })
    await repo.applyWrites({
      action: WriteOpAction.Delete,
      collection: 'app.bsky.feed.post',
      rkey: '1',
    })

    const afterDelete = (await repo.commit(testSpace, keypair)).hash
    expect(afterDelete).toEqual(emptyHash)
  })

  it('SpaceRepo.load recomputes set hash from storage', async () => {
    await repo.applyWrites([
      {
        action: WriteOpAction.Create,
        collection: 'app.bsky.feed.post',
        rkey: '1',
        record: { text: 'hello' },
      },
      {
        action: WriteOpAction.Create,
        collection: 'app.bsky.feed.post',
        rkey: '2',
        record: { text: 'world' },
      },
    ])

    const commit = await repo.commit(testSpace, keypair)

    const loaded = await SpaceRepo.load(repo.storage, 'did:example:alice')
    expect(loaded.verifyCommit(testSpace, commit)).toBe(true)
  })
})

describe('credentials', () => {
  let keypairA: Secp256k1Keypair
  let keypairB: Secp256k1Keypair
  const spaceUri = 'at://did:plc:authority/space/app.bsky.group/myspace'

  beforeAll(async () => {
    keypairA = await Secp256k1Keypair.create()
    keypairB = await Secp256k1Keypair.create()
  })

  describe('delegation tokens', () => {
    it('creates and verifies a delegation token', async () => {
      const token = await createDelegationToken(
        {
          iss: 'did:plc:user',
          aud: 'did:plc:authority#atproto_space_host',
          sub: spaceUri,
        },
        keypairA,
      )

      expect(typeof token).toBe('string')

      const payload = await verifyDelegationToken(token, keypairA.did())
      expect(payload.iss).toBe('did:plc:user')
      expect(payload.aud).toBe('did:plc:authority#atproto_space_host')
      expect(payload.sub).toBe(spaceUri)
    })

    it('defaults to a 60-second expiry', async () => {
      const token = await createDelegationToken(
        {
          iss: 'did:plc:user',
          aud: 'did:plc:authority#atproto_space_host',
          sub: spaceUri,
        },
        keypairA,
      )
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
      )
      expect(payload.exp - payload.iat).toBe(60)
    })

    it('uses the atproto-space-delegation+jwt typ and #atproto kid', async () => {
      const token = await createDelegationToken(
        {
          iss: 'did:plc:user',
          aud: 'did:plc:authority#atproto_space_host',
          sub: spaceUri,
        },
        keypairA,
      )
      const header = JSON.parse(
        Buffer.from(token.split('.')[0], 'base64url').toString('utf8'),
      )
      expect(header.typ).toBe('atproto-space-delegation+jwt')
      expect(header.kid).toBe('#atproto')
    })

    it('rejects a token signed by a different key', async () => {
      const token = await createDelegationToken(
        {
          iss: 'did:plc:user',
          aud: 'did:plc:authority#atproto_space_host',
          sub: spaceUri,
        },
        keypairA,
      )
      await expect(
        verifyDelegationToken(token, keypairB.did()),
      ).rejects.toThrow('Invalid JWT signature')
    })
  })

  describe('space credentials', () => {
    it('creates and verifies a space credential', async () => {
      const credential = await createSpaceCredential(
        {
          iss: 'did:plc:authority',
          sub: spaceUri,
        },
        keypairA,
      )

      const payload = await verifySpaceCredential(credential, keypairA.did())
      expect(payload.iss).toBe('did:plc:authority')
      expect(payload.sub).toBe(spaceUri)
    })

    it('defaults to a 2-hour expiry and uses #atproto_space kid', async () => {
      const credential = await createSpaceCredential(
        { iss: 'did:plc:authority', sub: spaceUri },
        keypairA,
      )
      const header = JSON.parse(
        Buffer.from(credential.split('.')[0], 'base64url').toString('utf8'),
      )
      const payload = JSON.parse(
        Buffer.from(credential.split('.')[1], 'base64url').toString('utf8'),
      )
      expect(header.typ).toBe('atproto-space-credential+jwt')
      expect(header.kid).toBe('#atproto_space')
      expect(payload.exp - payload.iat).toBe(7200)
    })

    it('rejects a credential signed by a different key', async () => {
      const credential = await createSpaceCredential(
        { iss: 'did:plc:authority', sub: spaceUri },
        keypairA,
      )
      await expect(
        verifySpaceCredential(credential, keypairB.did()),
      ).rejects.toThrow('Invalid JWT signature')
    })
  })

  describe('client attestation', () => {
    const clientId = 'https://app.example.com/client-metadata.json'

    it('parses a structurally valid attestation', async () => {
      const attestation = await createClientAttestation(
        { clientId, aud: 'did:plc:authority#atproto_space_host' },
        keypairA,
      )
      const { header, payload } = parseClientAttestation(attestation)
      expect(header.typ).toBe('atproto-client-attestation+jwt')
      expect(payload.iss).toBe(clientId)
      expect(payload.sub).toBe(clientId)
      expect(payload.aud).toBe('did:plc:authority#atproto_space_host')
    })

    it('rejects a non-attestation typ', async () => {
      const credential = await createSpaceCredential(
        { iss: 'did:plc:authority', sub: spaceUri },
        keypairA,
      )
      expect(() => parseClientAttestation(credential)).toThrow(
        'Invalid JWT type',
      )
    })
  })

  describe('type validation', () => {
    it('rejects a space credential verified as a delegation token', async () => {
      const credential = await createSpaceCredential(
        { iss: 'did:plc:authority', sub: spaceUri },
        keypairA,
      )
      await expect(
        verifyDelegationToken(credential, keypairA.did()),
      ).rejects.toThrow('Invalid JWT type')
    })

    it('rejects a delegation token verified as a space credential', async () => {
      const token = await createDelegationToken(
        {
          iss: 'did:plc:user',
          aud: 'did:plc:authority#atproto_space_host',
          sub: spaceUri,
        },
        keypairA,
      )
      await expect(
        verifySpaceCredential(token, keypairA.did()),
      ).rejects.toThrow('Invalid JWT type')
    })
  })
})
