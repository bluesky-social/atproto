import { AtpAgent } from '@atproto/api'
import { Database } from '../../src'
import usersSeed from '../seeds/users'
import { RecordRef, SeedClient } from '../seeds/client'
import { CloseFn, runTestServer } from '../_util'

describe('post hierarchy migration', () => {
  let db: Database
  let close: CloseFn
  let sc: SeedClient
  const threads: Item[] = [
    item(1, [item(2, [item(3), item(4)])]),
    item(5, [item(6), item(7, [item(9, [item(11)]), item(10)]), item(8)]),
    item(12),
  ]

  beforeAll(async () => {
    const server = await runTestServer(
      {
        dbPostgresSchema: 'migration_post_hierarchy',
      },
      {
        migration: '_20230208T081544325Z',
      },
    )
    db = server.ctx.db
    close = server.close
    const agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await threadSeed(sc, threads)
    await db.migrateToOrThrow('_20230210T210132396Z')
  })

  afterAll(async () => {
    await close()
  })

  it('indexes full post thread hierarchy.', async () => {
    let closureSize = 0
    const itemByUri: Record<string, Item> = {}

    const postsAndReplies = ([] as { text: string; ref: RecordRef }[])
      .concat(Object.values(sc.posts[sc.dids.alice]))
      .concat(Object.values(sc.replies[sc.dids.alice]))

    await walk(threads, async (item, depth) => {
      const post = postsAndReplies.find((p) => p.text === String(item.id))
      if (!post) throw new Error('Post not found')
      itemByUri[post.ref.uriStr] = item
      closureSize += depth + 1
    })

    const hierarchy = await db.db
      .selectFrom('post_hierarchy')
      .selectAll()
      .execute()

    expect(hierarchy.length).toEqual(closureSize)

    for (const relation of hierarchy) {
      const item = itemByUri[relation.uri]
      const ancestor = itemByUri[relation.ancestorUri]
      let depth = -1
      await walk([ancestor], async (candidate, candidateDepth) => {
        if (candidate === item) {
          depth = candidateDepth
        }
      })
      expect(depth).toEqual(relation.depth)
    }
  })
})

async function threadSeed(sc: SeedClient, threads: Item[]) {
  await usersSeed(sc)
  const refByItemId: Record<string, RecordRef> = {}
  const rootByItemId: Record<string, RecordRef> = {}
  await walk(threads, async (item, _depth, parent) => {
    if (parent !== undefined) {
      const parentRef = refByItemId[parent.id]
      const rootRef = rootByItemId[parent.id]
      const { ref } = await sc.reply(
        sc.dids.alice,
        rootRef,
        parentRef,
        String(item.id),
      )
      refByItemId[item.id] = ref
      rootByItemId[item.id] = rootRef
    } else {
      const { ref } = await sc.post(sc.dids.alice, String(item.id))
      refByItemId[item.id] = ref
      rootByItemId[item.id] = ref
    }
  })
}

function item(id: number, children: Item[] = []) {
  return { id, children }
}

async function walk(
  items: Item[],
  cb: (item: Item, depth: number, parent?: Item) => Promise<void>,
  depth = 0,
  parent?: Item,
) {
  for (const item of items) {
    await cb(item, depth, parent)
    await walk(item.children, cb, depth + 1, item)
  }
}

interface Item {
  id: number
  children: Item[]
}
