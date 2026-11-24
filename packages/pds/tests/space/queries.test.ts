import type { DidString, NsidString } from '@atproto/syntax'
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

describe('listSpaces', () => {
  let h: SpaceTestDb
  const ALICE = 'did:example:alice' as DidString
  const A = 'com.example.a' as NsidString
  const B = 'com.example.b' as NsidString
  const refs = {
    1: new SpaceRef(ALICE, A, '1'),
    2: new SpaceRef(ALICE, A, '2'),
    3: new SpaceRef(ALICE, B, '3'),
    4: new SpaceRef(ALICE, A, '4'), // tombstoned
    5: new SpaceRef('did:example:alicea' as DidString, A, '5'),
    6: new SpaceRef('did:example:alic' as DidString, A, '6'),
  }

  const skeys = async (opts: {
    type?: NsidString
    authority?: DidString
    cursor?: string
    limit?: number
  }) =>
    (await h.space.listSpaces({ limit: 10, ...opts })).map(
      (row) => SpaceRef.parse(row.uri).skey,
    )

  beforeAll(async () => {
    h = await createSpaceTestDb()
    for (const ref of Object.values(refs)) {
      await h.space.ensureSpace(ref)
    }
    await h.db.db
      .updateTable('space')
      .set({ deletedAt: new Date().toISOString() })
      .where('uri', '=', refs[4].toString())
      .execute()
  })

  afterAll(async () => {
    await h.close()
  })

  it('space keeps type, derives authority from the uri', () => {
    const columns = h.sqlite
      .prepare('pragma table_info(space)')
      .all()
      .map((row) => (row as { name: string }).name)
    expect(columns).not.toContain('authority')
    const { sql } = h.sqlite
      .prepare(`select sql from sqlite_master where name = 'space_type_idx'`)
      .get() as { sql: string }
    expect(sql).toMatch(/\("type", "uri"\) where "deletedAt" is null/)
  })

  it('reads each filter through an index', async () => {
    const planOf = async (opts: Parameters<typeof skeys>[0]) => {
      await skeys(opts)
      return h.plan(lastQueryOn(h.queries, 'space'))
    }
    expectIndexed(await planOf({}), /sqlite_autoindex_space_1/)
    expectIndexed(
      await planOf({ authority: ALICE }),
      /sqlite_autoindex_space_1 \(uri>\? AND uri<\?\)/,
    )
    expectIndexed(await planOf({ type: A }), /space_type_idx \(type=\?/)
    expectIndexed(
      await planOf({ type: A, authority: ALICE }),
      /space_type_idx \(type=\? AND uri>\? AND uri<\?\)/,
    )
  })

  it('filters by authority and type, leaving out tombstones', async () => {
    expect(await skeys({ authority: ALICE })).toEqual(['1', '2', '3'])
    expect(await skeys({ type: A })).toEqual(['6', '1', '2', '5'])
    expect(await skeys({ type: A, authority: ALICE })).toEqual(['1', '2'])
  })

  it('pages through an authority with the cursor', async () => {
    const paged: string[] = []
    let cursor: string | undefined
    for (;;) {
      const page = await h.space.listSpaces({ limit: 1, authority: ALICE, cursor })
      if (page.length === 0) break
      paged.push(SpaceRef.parse(page[0].uri).skey)
      cursor = page[0].uri
    }
    expect(paged).toEqual(['1', '2', '3'])
  })

  it('lists a re-created space again', async () => {
    await h.space.ensureSpace(refs[4])
    expect(await skeys({ type: A, authority: ALICE })).toEqual(['1', '2', '4'])
  })
})
