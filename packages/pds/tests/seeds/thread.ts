import { RecordRef, SeedClient } from '@atproto/dev-env'

export default async (sc: SeedClient, did, threads: Item[]) => {
  const refByItemId: Record<string, RecordRef> = {}
  const rootByItemId: Record<string, RecordRef> = {}
  await walk(threads, async (item, _depth, parent) => {
    if (parent !== undefined) {
      const parentRef = refByItemId[parent.id]
      const rootRef = rootByItemId[parent.id]
      const { ref } = await sc.reply(did, rootRef, parentRef, String(item.id))
      refByItemId[item.id] = ref
      rootByItemId[item.id] = rootRef
    } else {
      const { ref } = await sc.post(did, String(item.id))
      refByItemId[item.id] = ref
      rootByItemId[item.id] = ref
    }
  })
}

export function item(id: number, children: Item[] = []) {
  return { id, children }
}

export async function walk(
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

export interface Item {
  id: number
  children: Item[]
}
