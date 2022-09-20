import { API as AdxApi } from '@adxp/api'
import { AdxUri } from '@adxp/common'
import * as util from './_util'
import getPort from 'get-port'

const USE_TEST_SERVER = true

const alice = { username: 'alice', did: 'did:example:alice' }
const bob = { username: 'bob', did: 'did:example:bob' }

describe('crud operations', () => {
  let url: string
  let client: AdxApi = new AdxApi()
  let closeFn: util.CloseFn

  beforeAll(async () => {
    console.debug('setting up')
    const port = USE_TEST_SERVER ? await getPort() : 2583
    closeFn = await util.runTestServer(port)
    url = `http://localhost:${port}`
    console.debug('setup done')
  })

  afterAll(async () => {
    await closeFn?.()
  })

  it('registers users', async () => {
    console.debug('registering users')
    await client.todo.adx.createAccount(
      url,
      {},
      { encoding: 'application/json', data: alice },
    )
    await client.todo.adx.createAccount(
      url,
      {},
      { encoding: 'application/json', data: bob },
    )
    console.debug('users registered')
  })

  it('describes repo', async () => {
    console.debug('describing repos')
    const description = await client.todo.adx.repoDescribe(url, {
      nameOrDid: alice.did,
    })
    expect(description.data.name).toBe(alice.username)
    expect(description.data.did).toBe(alice.did)
    const description2 = await client.todo.adx.repoDescribe(url, {
      nameOrDid: bob.did,
    })
    expect(description2.data.name).toBe(bob.username)
    expect(description2.data.did).toBe(bob.did)
    console.debug('repos described')
  })

  let uri: AdxUri
  it('creates records', async () => {
    const res = await client.todo.adx.repoCreateRecord(
      url,
      { did: alice.did, type: 'todo.social.post' },
      {
        encoding: 'application/json',
        data: {
          $type: 'todo.social.post',
          text: 'Hello, world!',
          createdAt: new Date().toISOString(),
        },
      },
    )
    expect(res.data.uri.toString()).toBe(
      `adx://${alice.did}/bsky/posts/${uri.recordKey}`,
    )
  })

  it('lists records', async () => {
    const res = await client.todo.adx.repoListRecords(url, {
      nameOrDid: alice.did,
      type: 'todo.social.post',
    })
    expect(res.data.records.length).toBe(1)
    expect(res.data.records[0].uri).toBe(uri.toString())
    /** @ts-ignore TODO!!! */
    expect(res.data.records[0].value.text).toBe('Hello, world!')
  })

  it('gets records', async () => {
    const res = await client.todo.adx.repoGetRecord(url, {
      nameOrDid: alice.did,
      type: 'todo.social.post',
      tid: uri.recordKey,
    })
    expect(res.data.uri).toBe(uri.toString())
    /** @ts-ignore TODO!!! */
    expect(res.data.value.text).toBe('Hello, world!')
  })

  it('puts records', async () => {
    const res = await client.todo.adx.repoPutRecord(
      url,
      { did: alice.did, type: 'todo.social.post', tid: uri.recordKey },
      {
        encoding: 'application/json',
        data: {
          $type: 'todo.social.post',
          text: 'Hello, universe!',
          createdAt: new Date().toISOString(),
        },
      },
    )
    expect(res.data.uri).toBe(uri.toString())

    const res2 = await client.todo.adx.repoGetRecord(url, {
      nameOrDid: alice.did,
      type: 'todo.social.post',
      tid: uri.recordKey,
    })
    expect(res2.data.uri).toBe(uri.toString())
    /** @ts-ignore TODO!!! */
    expect(res2.data.value.text).toBe('Hello, universe!')
  })

  it('deletes records', async () => {
    await client.todo.adx.repoDeleteRecord(url, {
      did: alice.did,
      type: 'todo.social.post',
      tid: uri.recordKey,
    })
    const res = await client.todo.adx.repoListRecords(url, {
      nameOrDid: alice.did,
      type: 'todo.social.post',
    })
    expect(res.data.records.length).toBe(0)
  })

  it('lists records with pagination', async () => {
    const doCreate = async (text: string) => {
      const res = await client.todo.adx.repoCreateRecord(
        url,
        { did: alice.did, type: 'todo.social.post' },
        {
          encoding: 'application/json',
          data: {
            $type: 'todo.social.post',
            text,
            createdAt: new Date().toISOString(),
          },
        },
      )
      return new AdxUri(res.data.uri)
    }
    const doList = async (params: any) => {
      const res = await client.todo.adx.repoListRecords(
        url,
        Object.assign(
          { nameOrDid: alice.did, type: 'todo.social.post' },
          params,
        ),
      )
      return res.data
    }
    const uri1 = await doCreate('Post 1')
    const uri2 = await doCreate('Post 2')
    const uri3 = await doCreate('Post 3')
    const uri4 = await doCreate('Post 4')
    {
      const list = await doList({ limit: 2 })
      expect(list.records.length).toBe(2)
      /** @ts-ignore TODO!!! */
      expect(list.records[0].value.text).toBe('Post 1')
      /** @ts-ignore TODO!!! */
      expect(list.records[1].value.text).toBe('Post 2')
    }
    {
      const list = await doList({ limit: 2, reverse: true })
      expect(list.records.length).toBe(2)
      /** @ts-ignore TODO!!! */
      expect(list.records[0].value.text).toBe('Post 4')
      /** @ts-ignore TODO!!! */
      expect(list.records[1].value.text).toBe('Post 3')
    }

    {
      const list = await doList({ after: uri2.recordKey })
      expect(list.records.length).toBe(2)
      /** @ts-ignore TODO!!! */
      expect(list.records[0].value.text).toBe('Post 3')
      /** @ts-ignore TODO!!! */
      expect(list.records[1].value.text).toBe('Post 4')
    }
    {
      const list = await doList({ before: uri3.recordKey })
      expect(list.records.length).toBe(2)
      /** @ts-ignore TODO!!! */
      expect(list.records[0].value.text).toBe('Post 1')
      /** @ts-ignore TODO!!! */
      expect(list.records[1].value.text).toBe('Post 2')
    }
    {
      const list = await doList({
        before: uri4.recordKey,
        after: uri1.recordKey,
      })
      expect(list.records.length).toBe(2)
      /** @ts-ignore TODO!!! */
      expect(list.records[0].value.text).toBe('Post 2')
      /** @ts-ignore TODO!!! */
      expect(list.records[1].value.text).toBe('Post 3')
    }

    await client.todo.adx.repoDeleteRecord(url, {
      did: alice.did,
      type: 'todo.social.post',
      tid: uri1.recordKey,
    })
    await client.todo.adx.repoDeleteRecord(url, {
      did: alice.did,
      type: 'todo.social.post',
      tid: uri2.recordKey,
    })
    await client.todo.adx.repoDeleteRecord(url, {
      did: alice.did,
      type: 'todo.social.post',
      tid: uri3.recordKey,
    })
    await client.todo.adx.repoDeleteRecord(url, {
      did: alice.did,
      type: 'todo.social.post',
      tid: uri4.recordKey,
    })
  })

  // Validation
  // --------------

  it('requires a $type on records', async () => {
    const prom1 = client.todo.adx.repoCreateRecord(
      url,
      { did: alice.did, type: 'todo.social.post' },
      {
        encoding: 'application/json',
        data: {},
      },
    )
    await expect(prom1).rejects.toThrow(
      'The passed value does not declare a $type',
    )
    const prom2 = client.todo.adx.repoPutRecord(
      url,
      { did: alice.did, type: 'todo.social.post', tid: 'foo' },
      {
        encoding: 'application/json',
        data: {},
      },
    )
    await expect(prom2).rejects.toThrow(
      'The passed value does not declare a $type',
    )
  })

  it('requires the schema to be known', async () => {
    const prom1 = client.todo.adx.repoListRecords(url, {
      nameOrDid: alice.did,
      type: 'com.example.foobar',
    })
    await expect(prom1).rejects.toThrow('Schema not found: com.example.foobar')
    const prom2 = client.todo.adx.repoCreateRecord(
      url,
      { did: alice.did, type: 'com.example.foobar' },
      {
        encoding: 'application/json',
        data: { $type: 'com.example.foobar' },
      },
    )
    await expect(prom2).rejects.toThrow('Schema not found: com.example.foobar')
    const prom3 = client.todo.adx.repoPutRecord(
      url,
      { did: alice.did, type: 'com.example.foobar', tid: 'foo' },
      {
        encoding: 'application/json',
        data: { $type: 'com.example.foobar' },
      },
    )
    await expect(prom3).rejects.toThrow('Schema not found: com.example.foobar')
  })

  it('requires the $type to match the schema', async () => {
    await expect(
      client.todo.adx.repoCreateRecord(
        url,
        { did: alice.did, type: 'todo.social.post' },
        {
          encoding: 'application/json',
          data: { $type: 'todo.social.like' },
        },
      ),
    ).rejects.toThrow('Record type todo.social.like is not supported')
    await expect(
      client.todo.adx.repoPutRecord(
        url,
        { did: alice.did, type: 'todo.social.post', tid: 'foo' },
        {
          encoding: 'application/json',
          data: { $type: 'todo.social.like' },
        },
      ),
    ).rejects.toThrow('Record type todo.social.like is not supported')
  })

  it('validates the record on write', async () => {
    await expect(
      client.todo.adx.repoCreateRecord(
        url,
        { did: alice.did, type: 'todo.social.post' },
        {
          encoding: 'application/json',
          data: { $type: 'todo.social.post' },
        },
      ),
    ).rejects.toThrow(
      "Failed todo.social.post validation for #/required: must have required property 'text'",
    )
    await expect(
      client.todo.adx.repoPutRecord(
        url,
        { did: alice.did, type: 'todo.social.post', tid: 'foo' },
        {
          encoding: 'application/json',
          data: { $type: 'todo.social.post' },
        },
      ),
    ).rejects.toThrow(
      "Failed todo.social.post validation for #/required: must have required property 'text'",
    )
  })

  it('validates the record on read', async () => {
    const res1 = await client.todo.adx.repoCreateRecord(
      url,
      { did: alice.did, type: 'todo.social.post', validate: false },
      {
        encoding: 'application/json',
        data: { $type: 'todo.social.post', record: 'is bad' },
      },
    )
    const res2 = await client.todo.adx.repoCreateRecord(
      url,
      { did: alice.did, type: 'todo.social.post', validate: false },
      {
        encoding: 'application/json',
        data: { $type: 'com.example.unknown', dunno: 'lol' },
      },
    )
    const res3 = await client.todo.adx.repoListRecords(url, {
      nameOrDid: alice.did,
      type: 'todo.social.post',
    })
    /** @ts-ignore TODO!!! */
    expect(res3.data.records[0].value.record).toBe('is bad')
    /** @ts-ignore TODO!!! */
    expect(res3.data.records[0].valid).toBeFalsy()
    /** @ts-ignore TODO!!! */
    expect(res3.data.records[0].fullySupported).toBeFalsy()
    /** @ts-ignore TODO!!! */
    expect(res3.data.records[0].compatible).toBeTruthy()
    /** @ts-ignore TODO!!! */
    expect(res3.data.records[0].error).toBe(
      `Failed todo.social.post validation for #/required: must have required property 'text'`,
    )
    /** @ts-ignore TODO!!! */
    expect(res3.data.records[1].value.dunno).toBe('lol')
    /** @ts-ignore TODO!!! */
    expect(res3.data.records[1].valid).toBeFalsy()
    /** @ts-ignore TODO!!! */
    expect(res3.data.records[1].fullySupported).toBeFalsy()
    /** @ts-ignore TODO!!! */
    expect(res3.data.records[1].compatible).toBeFalsy()
    /** @ts-ignore TODO!!! */
    expect(res3.data.records[1].error).toBe(
      `Record type com.example.unknown is not supported`,
    )
    const res4 = await client.todo.adx.repoGetRecord(url, {
      nameOrDid: alice.did,
      type: 'todo.social.post',
      tid: new AdxUri(res1.data.uri).recordKey,
    })
    /** @ts-ignore TODO!!! */
    expect(res4.data.value.record).toBe('is bad')
    /** @ts-ignore TODO!!! */
    expect(res4.data.valid).toBeFalsy()
    /** @ts-ignore TODO!!! */
    expect(res4.data.fullySupported).toBeFalsy()
    /** @ts-ignore TODO!!! */
    expect(res4.data.compatible).toBeTruthy()
    /** @ts-ignore TODO!!! */
    expect(res4.data.error).toBe(
      `Failed todo.social.post validation for #/required: must have required property 'text'`,
    )
    const res5 = await client.todo.adx.repoGetRecord(url, {
      nameOrDid: alice.did,
      type: 'todo.social.post',
      tid: new AdxUri(res2.data.uri).recordKey,
    })
    /** @ts-ignore TODO!!! */
    expect(res5.data.value.dunno).toBe('lol')
    /** @ts-ignore TODO!!! */
    expect(res5.data.valid).toBeFalsy()
    /** @ts-ignore TODO!!! */
    expect(res5.data.fullySupported).toBeFalsy()
    /** @ts-ignore TODO!!! */
    expect(res5.data.compatible).toBeFalsy()
    /** @ts-ignore TODO!!! */
    expect(res5.data.error).toBe(
      `Record type com.example.unknown is not supported`,
    )
    await client.todo.adx.repoDeleteRecord(url, {
      did: alice.did,
      type: 'todo.social.post',
      tid: new AdxUri(res1.data.uri).recordKey,
    })
    await client.todo.adx.repoDeleteRecord(url, {
      did: alice.did,
      type: 'todo.social.post',
      tid: new AdxUri(res2.data.uri).recordKey,
    })
  })
})
