import { encode } from '@atproto/lex-cbor'
import { cidForCbor } from '@atproto/lex-data'
import { WriteOpAction } from '@atproto/repo'
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

describe('listRepoOps', () => {
  let h: SpaceTestDb
  const ref = new SpaceRef(SPACE_DID, TYPE, 'ops')
  const space = ref.toString()
  const revs: string[] = []

  const list = (opts: {
    limit?: number
    since?: string
    cursor?: { rev: string; idx: number }
  }) => h.space.listRepoOps(space, { limit: 10, ...opts })

  beforeAll(async () => {
    h = await createSpaceTestDb()
    const commit1 = await putRecords(h, ref, [
      [FOO, 'a'],
      [FOO, 'b'],
    ])
    const record = { $type: FOO, rkey: 'a', updated: true }
    const cid = await cidForCbor(encode(record))
    const commit2 = await h.transact((txn) =>
      txn.applyWrites(ref, [
        {
          action: WriteOpAction.Update,
          uri: ref.recordUri(txn.did, FOO, 'a'),
          cid,
          record,
          blobs: [],
        },
      ]),
    )
    const commit3 = await putRecords(h, ref, [[FOO, 'c']])
    revs.push(commit1!.rev, commit2!.rev, commit3!.rev)
  })

  afterAll(async () => {
    await h.close()
  })

  it('the oplog keeps only what it serves', () => {
    const columns = h.sqlite
      .prepare('pragma table_info(space_record_oplog)')
      .all()
      .map((row) => (row as { name: string }).name)
    expect(columns).toEqual([
      'space',
      'rev',
      'idx',
      'collection',
      'rkey',
      'cid',
      'prev',
    ])
  })

  it('seeks to the cursor and joins records by path', async () => {
    await list({ cursor: { rev: revs[0], idx: 0 } })
    const lines = h.plan(lastQueryOn(h.queries, 'space_record_oplog'))
    expectIndexed(
      lines,
      /sqlite_autoindex_space_record_oplog_1 \(space=\? AND \(rev,idx\)>\(\?,\?\)\)/,
    )
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /space_record_path_idx \(space=\? AND collection=\? AND rkey=\?\)/,
        ),
      ]),
    )
  })

  it('serves values only for ops that are still current', async () => {
    const ops = await list({})
    expect(ops.map((op) => [op.rev, op.idx, op.rkey])).toEqual([
      [revs[0], 0, 'a'],
      [revs[0], 1, 'b'],
      [revs[1], 0, 'a'],
      [revs[2], 0, 'c'],
    ])
    expect(ops.map((op) => op.value !== undefined)).toEqual([
      false,
      true,
      true,
      true,
    ])
  })

  it('pages from the cursor, within and across commits', async () => {
    const first = await list({ cursor: { rev: revs[0], idx: 0 } })
    expect(first.map((op) => op.rkey)).toEqual(['b', 'a', 'c'])

    const paged: string[] = []
    let cursor: { rev: string; idx: number } | undefined
    for (;;) {
      const [op] = await list({ limit: 1, cursor })
      if (!op) break
      paged.push(`${op.rev}/${op.idx}`)
      cursor = { rev: op.rev, idx: op.idx }
    }
    expect(paged).toEqual([
      `${revs[0]}/0`,
      `${revs[0]}/1`,
      `${revs[1]}/0`,
      `${revs[2]}/0`,
    ])
  })

  it('applies whichever of since and cursor is later', async () => {
    const after = async (opts: Parameters<typeof list>[0]) =>
      (await list(opts)).map((op) => op.rev)
    expect(
      await after({ since: revs[1], cursor: { rev: revs[0], idx: 0 } }),
    ).toEqual([revs[2]])
    expect(
      await after({ since: revs[0], cursor: { rev: revs[1], idx: 0 } }),
    ).toEqual([revs[2]])
  })
})

describe('isBlobInSpace', () => {
  let h: SpaceTestDb
  const ref = new SpaceRef(SPACE_DID, TYPE, 'abc')
  const longerSkey = new SpaceRef(SPACE_DID, TYPE, 'abcd')
  const otherType = new SpaceRef(
    SPACE_DID,
    'com.example.groupX' as NsidString,
    'abc',
  )
  const BLOB = 'bafyblob'

  beforeAll(async () => {
    h = await createSpaceTestDb()
    await putRecords(h, ref, [[FOO, 'a']])
    await h.db.db
      .insertInto('space_record_blob')
      .values({
        blobCid: BLOB,
        recordUri: ref.recordUri(h.space.did, FOO, 'a').toString(),
      })
      .execute()
  })

  afterAll(async () => {
    await h.close()
  })

  it('is a single covering lookup', async () => {
    await h.space.isBlobInSpace(ref.toString(), BLOB)
    const q = lastQueryOn(h.queries, 'space_record_blob')
    expectIndexed(
      h.plan(q),
      /COVERING INDEX sqlite_autoindex_space_record_blob_1 \(blobCid=\? AND recordUri>\? AND recordUri<\?\)/,
    )
    expect(q.sql).not.toMatch(/join/i)
    expect(q.sql).toMatch(/limit/i)
  })

  it('finds the blob only in its own space', async () => {
    expect(await h.space.isBlobInSpace(ref.toString(), BLOB)).toBe(true)
    expect(await h.space.isBlobInSpace(longerSkey.toString(), BLOB)).toBe(false)
    expect(await h.space.isBlobInSpace(otherType.toString(), BLOB)).toBe(false)
    expect(await h.space.isBlobInSpace(ref.toString(), 'bafyother')).toBe(false)
  })
})
