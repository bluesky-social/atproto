import { Secp256k1Keypair } from '@atproto/crypto'
import {
  MemoryStorage,
  RecordAlreadyExistsError,
  RecordNotFoundError,
  Repo,
  SetHash,
  SpaceContext,
} from '../src'

const testSpace: SpaceContext = {
  spaceDid: 'did:example:space',
  spaceType: 'app.bsky.group',
  spaceKey: 'test',
  userDid: 'did:example:alice',
  rev: 0,
}

describe('Repo', () => {
  let repo: Repo

  beforeEach(() => {
    const storage = new MemoryStorage()
    repo = Repo.create(storage, 'did:example:alice')
  })

  it('creates and reads a record', async () => {
    await repo.createRecord('app.bsky.feed.post', '1', { text: 'hello' })
    const record = await repo.getRecord('app.bsky.feed.post', '1')
    expect(record).toEqual({ text: 'hello' })
  })

  it('returns null for missing record', async () => {
    const record = await repo.getRecord('app.bsky.feed.post', 'missing')
    expect(record).toBeNull()
  })

  it('throws on duplicate create', async () => {
    await repo.createRecord('app.bsky.feed.post', '1', { text: 'hello' })
    await expect(
      repo.createRecord('app.bsky.feed.post', '1', { text: 'dupe' }),
    ).rejects.toThrow(RecordAlreadyExistsError)
  })

  it('updates an existing record', async () => {
    await repo.createRecord('app.bsky.feed.post', '1', { text: 'hello' })
    await repo.updateRecord('app.bsky.feed.post', '1', { text: 'updated' })
    const record = await repo.getRecord('app.bsky.feed.post', '1')
    expect(record).toEqual({ text: 'updated' })
  })

  it('throws on update of missing record', async () => {
    await expect(
      repo.updateRecord('app.bsky.feed.post', 'missing', { text: 'nope' }),
    ).rejects.toThrow(RecordNotFoundError)
  })

  it('deletes a record', async () => {
    await repo.createRecord('app.bsky.feed.post', '1', { text: 'hello' })
    await repo.deleteRecord('app.bsky.feed.post', '1')
    const record = await repo.getRecord('app.bsky.feed.post', '1')
    expect(record).toBeNull()
  })

  it('throws on delete of missing record', async () => {
    await expect(
      repo.deleteRecord('app.bsky.feed.post', 'missing'),
    ).rejects.toThrow(RecordNotFoundError)
  })

  it('lists collections', async () => {
    await repo.createRecord('app.bsky.feed.post', '1', { text: 'hello' })
    await repo.createRecord('app.bsky.feed.like', '1', { subject: 'x' })
    const collections = await repo.listCollections()
    expect(collections.sort()).toEqual([
      'app.bsky.feed.like',
      'app.bsky.feed.post',
    ])
  })

  it('lists records in a collection', async () => {
    await repo.createRecord('app.bsky.feed.post', '1', { text: 'first' })
    await repo.createRecord('app.bsky.feed.post', '2', { text: 'second' })
    const records = await repo.listRecords('app.bsky.feed.post')
    expect(records).toHaveLength(2)
    expect(records.map((r) => r.rkey).sort()).toEqual(['1', '2'])
  })

  it('exposes did', () => {
    expect(repo.did).toBe('did:example:alice')
  })
})

describe('SetHash', () => {
  it('starts empty as zeroed bytes', () => {
    const h = new SetHash()
    expect(h.toBytes()).toEqual(Buffer.alloc(32))
  })

  it('constructs from hex', () => {
    const h1 = new SetHash()
    expect(h1.toHex()).toBe('0'.repeat(64))
    const h2 = new SetHash(h1.toHex())
    expect(h1.equals(h2)).toBe(true)
  })

  it('constructs from bytes', () => {
    const bytes = Buffer.alloc(32, 0xab)
    const h = new SetHash(bytes)
    expect(h.toBytes()).toEqual(bytes)
  })

  it('is order-independent', async () => {
    const h1 = new SetHash()
    await h1.add('alpha')
    await h1.add('beta')

    const h2 = new SetHash()
    await h2.add('beta')
    await h2.add('alpha')

    expect(h1.equals(h2)).toBe(true)
  })

  it('remove reverses add', async () => {
    const h = new SetHash()
    await h.add('element')
    await h.remove('element')
    expect(h.equals(new SetHash())).toBe(true)
  })

  it('does not copy internal state on construct from bytes', () => {
    const bytes = Buffer.alloc(32, 0xab)
    const h = new SetHash(bytes)
    bytes[0] = 0xff
    expect(h.toBytes()[0]).toBe(0xab)
  })
})

describe('commits', () => {
  let repo: Repo
  let keypair: Secp256k1Keypair

  beforeAll(async () => {
    keypair = await Secp256k1Keypair.create()
  })

  beforeEach(() => {
    const storage = new MemoryStorage()
    repo = Repo.create(storage, 'did:example:alice')
  })

  it('creates a valid signed commit', async () => {
    await repo.createRecord('app.bsky.feed.post', '1', { text: 'hello' })
    const commit = await repo.commit(testSpace, keypair)
    expect(commit.hash).toBeInstanceOf(Buffer)
    expect(commit.hmac).toBeInstanceOf(Buffer)
    expect(commit.ikm).toBeInstanceOf(Buffer)
    expect(commit.sig).toBeInstanceOf(Buffer)
  })

  it('produces different ikm per commit (deniability)', async () => {
    await repo.createRecord('app.bsky.feed.post', '1', { text: 'hello' })
    const c1 = await repo.commit(testSpace, keypair)
    const c2 = await repo.commit(testSpace, keypair)
    expect(c1.ikm).not.toEqual(c2.ikm)
    expect(c1.hmac).not.toEqual(c2.hmac)
    expect(c1.hash).toEqual(c2.hash)
  })

  it('repo verifies its own commit', async () => {
    await repo.createRecord('app.bsky.feed.post', '1', { text: 'hello' })
    const commit = await repo.commit(testSpace, keypair)
    expect(repo.verifyCommit(testSpace, commit)).toBe(true)
  })

  it('commit does not verify after repo changes', async () => {
    await repo.createRecord('app.bsky.feed.post', '1', { text: 'hello' })
    const commit = await repo.commit(testSpace, keypair)
    await repo.createRecord('app.bsky.feed.post', '2', { text: 'world' })
    expect(repo.verifyCommit(testSpace, commit)).toBe(false)
  })

  it('two repos with same records produce same hash', async () => {
    const storage2 = new MemoryStorage()
    const repo2 = Repo.create(storage2, 'did:example:bob')

    await repo.createRecord('app.bsky.feed.post', '1', { text: 'hello' })
    await repo.createRecord('app.bsky.feed.post', '2', { text: 'world' })

    // Add in different order
    await repo2.createRecord('app.bsky.feed.post', '2', { text: 'world' })
    await repo2.createRecord('app.bsky.feed.post', '1', { text: 'hello' })

    const c1 = await repo.commit(testSpace, keypair)
    const c2 = await repo2.commit(testSpace, keypair)
    expect(c1.hash).toEqual(c2.hash)
  })

  it('update changes the hash correctly', async () => {
    await repo.createRecord('app.bsky.feed.post', '1', { text: 'hello' })
    const before = await repo.commit(testSpace, keypair)

    await repo.updateRecord('app.bsky.feed.post', '1', { text: 'updated' })
    const after = await repo.commit(testSpace, keypair)

    expect(before.hash).not.toEqual(after.hash)
  })

  it('delete reverses add for set hash', async () => {
    const emptyHash = (await repo.commit(testSpace, keypair)).hash

    await repo.createRecord('app.bsky.feed.post', '1', { text: 'hello' })
    await repo.deleteRecord('app.bsky.feed.post', '1')

    const afterDelete = (await repo.commit(testSpace, keypair)).hash
    expect(afterDelete).toEqual(emptyHash)
  })

  it('Repo.load recomputes set hash from storage', async () => {
    await repo.createRecord('app.bsky.feed.post', '1', { text: 'hello' })
    await repo.createRecord('app.bsky.feed.post', '2', { text: 'world' })

    const commit = await repo.commit(testSpace, keypair)

    // Load from same storage
    const loaded = await Repo.load(repo.storage, 'did:example:alice')
    expect(loaded.verifyCommit(testSpace, commit)).toBe(true)
  })
})
