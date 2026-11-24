import type { NsidString } from '@atproto/syntax'
import { SpaceRef } from '@atproto/syntax'
import {
  SPACE_DID,
  type SpaceTestDb,
  createSpaceTestDb,
  expectIndexed,
  lastQueryOn,
  putRecords,
} from './_db.js'

// Each space query must read only the rows it returns, through an index, and
// never sort a whole space. These run the actor store's real queries against an
// in-memory database and check their plans with EXPLAIN QUERY PLAN.

const TYPE = 'com.example.group' as NsidString
const FOO = 'com.example.foo' as NsidString

describe('space record paging', () => {
  let h: SpaceTestDb
  const ref = new SpaceRef(SPACE_DID, TYPE, 'abc')
  const other = new SpaceRef(SPACE_DID, TYPE, 'xyz')
  const space = ref.toString()
  const uriOf = (collection: string, rkey: string) =>
    ref.recordUri(h.space.did, collection as NsidString, rkey).toString()

  const PK_RANGE = /sqlite_autoindex_space_record_1 \(uri>\? AND uri<\?\)/

  beforeAll(async () => {
    h = await createSpaceTestDb()
    await putRecords(h, ref, [
      [FOO, 'a'],
      [FOO, 'b'],
      [FOO, 'c'],
      ['com.example.foo.bar', 'a'],
      ['com.example.foo2', 'a'],
    ])
    await putRecords(h, other, [[FOO, 'a']])
  })

  afterAll(async () => {
    await h.close()
  })

  const streamPaths = async () => {
    const paths: string[] = []
    for await (const row of h.space.streamRecords(space)) {
      paths.push(`${row.collection}/${row.rkey}`)
    }
    return paths
  }

  it('streamRecords pages without sorting', async () => {
    await streamPaths()
    expectIndexed(h.plan(lastQueryOn(h.queries, 'space_record')), PK_RANGE)
  })

  it('listRecords pages without sorting', async () => {
    await h.space.listRecords(space, { limit: 2, excludeValues: true })
    expectIndexed(h.plan(lastQueryOn(h.queries, 'space_record')), PK_RANGE)

    await h.space.listRecords(space, {
      limit: 2,
      excludeValues: true,
      cursor: uriOf(FOO, 'b'),
    })
    expectIndexed(h.plan(lastQueryOn(h.queries, 'space_record')), PK_RANGE)

    await h.space.listRecords(space, {
      limit: 2,
      excludeValues: true,
      collection: FOO,
    })
    expectIndexed(h.plan(lastQueryOn(h.queries, 'space_record')), PK_RANGE)
  })

  // Record-path order, as a serialized repo requires. That differs from
  // (collection, rkey) order when one NSID is a prefix of another.
  it('streamRecords returns record-path order', async () => {
    const paths = await streamPaths()
    expect(paths).toEqual([...paths].sort((a, b) => (a < b ? -1 : 1)))
    expect(paths).toEqual([
      'com.example.foo.bar/a',
      'com.example.foo/a',
      'com.example.foo/b',
      'com.example.foo/c',
      'com.example.foo2/a',
    ])
  })

  it('listRecords filters by collection exactly', async () => {
    const list = (cursor?: string, limit = 10) =>
      h.space.listRecords(space, {
        limit,
        cursor,
        collection: FOO,
        excludeValues: true,
      })
    const rkeys = async (cursor?: string) =>
      (await list(cursor)).map((row) => row.rkey)

    expect(await rkeys()).toEqual(['c', 'b', 'a'])

    const paged: string[] = []
    let cursor: string | undefined
    for (;;) {
      const page = await list(cursor, 1)
      if (page.length === 0) break
      paged.push(page[0].rkey)
      cursor = page[0].uri
    }
    expect(paged).toEqual(['c', 'b', 'a'])

    // A cursor from another collection bounds the listing as it would anywhere.
    expect(await rkeys(uriOf('com.example.foo2', 'a'))).toEqual(['c', 'b', 'a'])
    expect(await rkeys(uriOf('com.example.foo.bar', 'a'))).toEqual([])
  })

  it('space_record carries only the path index beside its primary key', () => {
    const names = h.sqlite
      .prepare(
        `select name from sqlite_master where type = 'index' and tbl_name = 'space_record' order by name`,
      )
      .all()
      .map((row) => (row as { name: string }).name)
    expect(names).toEqual([
      'space_record_path_idx',
      'sqlite_autoindex_space_record_1',
    ])
  })
})
