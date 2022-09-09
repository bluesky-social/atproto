import { AdxClient, AdxUri } from '@adxp/api'
import { schemas } from '@adxp/microblog'

const url = 'http://localhost:2583'
const adx = new AdxClient({
  pds: url,
  schemas: schemas,
})
const alice = { username: 'alice', did: 'did:example:alice' }
const bob = { username: 'bob', did: 'did:example:bob' }

describe('crud operations', () => {
  it('registers users', async () => {
    await adx.mainPds.registerRepo(alice)
    await adx.mainPds.registerRepo(bob)
  })

  it('describes repo', async () => {
    const description = await adx.mainPds.repo(alice.did).describe()
    expect(description.name).toBe(alice.username)
    expect(description.did).toBe(alice.did)
    const description2 = await adx.mainPds.repo(bob.did).describe()
    expect(description2.name).toBe(bob.username)
    expect(description2.did).toBe(bob.did)
  })

  let uri: AdxUri
  it('creates records', async () => {
    uri = await adx.mainPds
      .repo(alice.did)
      .collection('bsky/posts')
      .create('*', {
        $type: 'blueskyweb.xyz:Post',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      })
    expect(uri.toString()).toBe(
      `adx://${alice.did}/bsky/posts/${uri.recordKey}`,
    )
  })

  it('lists records', async () => {
    const res = await adx.mainPds
      .repo(alice.did)
      .collection('bsky/posts')
      .list('*')
    expect(res.records.length).toBe(1)
    expect(res.records[0].uri).toBe(uri.toString())
    expect(res.records[0].value.text).toBe('Hello, world!')
  })

  it('gets records', async () => {
    const res = await adx.mainPds
      .repo(alice.did)
      .collection('bsky/posts')
      .get('*', uri.recordKey)
    expect(res.uri).toBe(uri.toString())
    expect(res.value.text).toBe('Hello, world!')
  })

  it('puts records', async () => {
    const res = await adx.mainPds
      .repo(alice.did)
      .collection('bsky/posts')
      .put('*', uri.recordKey, {
        $type: 'blueskyweb.xyz:Post',
        text: 'Hello, universe!',
        createdAt: new Date().toISOString(),
      })
    expect(res.toString()).toBe(uri.toString())

    const res2 = await adx.mainPds
      .repo(alice.did)
      .collection('bsky/posts')
      .get('*', uri.recordKey)
    expect(res2.uri).toBe(uri.toString())
    expect(res2.value.text).toBe('Hello, universe!')
  })

  it('deletes records', async () => {
    await adx.mainPds
      .repo(alice.did)
      .collection('bsky/posts')
      .del(uri.recordKey)
    const res = await adx.mainPds
      .repo(alice.did)
      .collection('bsky/posts')
      .list('*')
    expect(res.records.length).toBe(0)
  })

  it('lists records with pagination', async () => {
    const feed = adx.mainPds.repo(alice.did).collection('bsky/posts')
    const uri1 = await feed.create('Post', {
      $type: 'blueskyweb.xyz:Post',
      text: 'Post 1',
      createdAt: new Date().toISOString(),
    })
    const uri2 = await feed.create('Post', {
      $type: 'blueskyweb.xyz:Post',
      text: 'Post 2',
      createdAt: new Date().toISOString(),
    })
    const uri3 = await feed.create('Post', {
      $type: 'blueskyweb.xyz:Post',
      text: 'Post 3',
      createdAt: new Date().toISOString(),
    })
    const uri4 = await feed.create('Post', {
      $type: 'blueskyweb.xyz:Post',
      text: 'Post 4',
      createdAt: new Date().toISOString(),
    })
    {
      const list = await feed.list('Post', { limit: 2 })
      expect(list.records.length).toBe(2)
      expect(list.records[0].value.text).toBe('Post 1')
      expect(list.records[1].value.text).toBe('Post 2')
    }
    {
      const list = await feed.list('Post', { limit: 2, reverse: true })
      expect(list.records.length).toBe(2)
      expect(list.records[0].value.text).toBe('Post 4')
      expect(list.records[1].value.text).toBe('Post 3')
    }

    {
      const list = await feed.list('Post', { after: uri2.recordKey })
      expect(list.records.length).toBe(2)
      expect(list.records[0].value.text).toBe('Post 3')
      expect(list.records[1].value.text).toBe('Post 4')
    }
    {
      const list = await feed.list('Post', { before: uri3.recordKey })
      expect(list.records.length).toBe(2)
      expect(list.records[0].value.text).toBe('Post 1')
      expect(list.records[1].value.text).toBe('Post 2')
    }
    {
      const list = await feed.list('Post', {
        before: uri4.recordKey,
        after: uri1.recordKey,
      })
      expect(list.records.length).toBe(2)
      expect(list.records[0].value.text).toBe('Post 2')
      expect(list.records[1].value.text).toBe('Post 3')
    }

    await feed.del(uri1.recordKey)
    await feed.del(uri2.recordKey)
    await feed.del(uri3.recordKey)
    await feed.del(uri4.recordKey)
  })
})

describe('validation', () => {
  it('requires a $type on records', async () => {
    const feed = adx.mainPds.repo(alice.did).collection('bsky/posts')
    await expect(feed.create('Post', {})).rejects.toThrow(
      'The passed value does not declare a $type',
    )
    await expect(feed.put('Post', 'foo', {})).rejects.toThrow(
      'The passed value does not declare a $type',
    )
  })

  it('requires the schema to be known', async () => {
    const feed = adx.mainPds.repo(alice.did).collection('bsky/posts')
    await expect(feed.list('Foobar')).rejects.toThrow(
      'Schema not found: Foobar',
    )
    await expect(feed.create('Foobar', {})).rejects.toThrow(
      'Schema not found: Foobar',
    )
    await expect(feed.put('Foobar', 'foo', {})).rejects.toThrow(
      'Schema not found: Foobar',
    )
  })

  it('requires the $type to match the schema', async () => {
    const feed = adx.mainPds.repo(alice.did).collection('bsky/posts')
    await expect(
      feed.create('Post', { $type: 'blueskyweb.xyz:Like' }),
    ).rejects.toThrow('Record type blueskyweb.xyz:Like is not supported')
    await expect(
      feed.put('Post', 'foo', { $type: 'blueskyweb.xyz:Like' }),
    ).rejects.toThrow('Record type blueskyweb.xyz:Like is not supported')
  })

  it('validates the record on write', async () => {
    const feed = adx.mainPds.repo(alice.did).collection('bsky/posts')
    await expect(
      feed.create('Post', { $type: 'blueskyweb.xyz:Post' }),
    ).rejects.toThrow(
      "Failed blueskyweb.xyz:Post validation for #/required: must have required property 'text'",
    )
    await expect(
      feed.put('Post', 'foo', { $type: 'blueskyweb.xyz:Post' }),
    ).rejects.toThrow(
      "Failed blueskyweb.xyz:Post validation for #/required: must have required property 'text'",
    )
  })

  it('validates the record on read', async () => {
    const feed = adx.mainPds.repo(alice.did).collection('bsky/posts')
    const uri1 = await feed.create(
      '*',
      {
        $type: 'blueskyweb.xyz:Post',
        record: 'is bad',
      },
      false,
    )
    const uri2 = await feed.create(
      '*',
      {
        $type: 'blueskyweb.xyz:Unknown',
        dunno: 'lol',
      },
      false,
    )
    const res1 = await feed.list('Post')
    expect(res1.records[0].value.record).toBe('is bad')
    expect(res1.records[0].valid).toBeFalsy()
    expect(res1.records[0].fullySupported).toBeFalsy()
    expect(res1.records[0].compatible).toBeTruthy()
    expect(res1.records[0].error).toBe(
      `Failed blueskyweb.xyz:Post validation for #/required: must have required property 'text'`,
    )
    expect(res1.records[1].value.dunno).toBe('lol')
    expect(res1.records[1].valid).toBeFalsy()
    expect(res1.records[1].fullySupported).toBeFalsy()
    expect(res1.records[1].compatible).toBeFalsy()
    expect(res1.records[1].error).toBe(
      `Record type blueskyweb.xyz:Unknown is not supported`,
    )
    const res2 = await feed.get('Post', uri1.recordKey)
    expect(res2.value.record).toBe('is bad')
    expect(res2.valid).toBeFalsy()
    expect(res2.fullySupported).toBeFalsy()
    expect(res2.compatible).toBeTruthy()
    expect(res2.error).toBe(
      `Failed blueskyweb.xyz:Post validation for #/required: must have required property 'text'`,
    )
    const res3 = await feed.get('Post', uri2.recordKey)
    expect(res3.value.dunno).toBe('lol')
    expect(res3.valid).toBeFalsy()
    expect(res3.fullySupported).toBeFalsy()
    expect(res3.compatible).toBeFalsy()
    expect(res3.error).toBe(
      `Record type blueskyweb.xyz:Unknown is not supported`,
    )
    await feed.del(uri1.recordKey)
    await feed.del(uri2.recordKey)
  })
})
