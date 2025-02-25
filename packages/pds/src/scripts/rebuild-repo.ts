import readline from 'node:readline/promises'
import { TID } from '@atproto/common'
import {
  BlockMap,
  CidSet,
  MST,
  MemoryBlockstore,
  signCommit,
} from '@atproto/repo'
import { AppContext } from '../context'

export const rebuildRepo = async (ctx: AppContext, args: string[]) => {
  const did = args[0]
  if (!did || !did.startsWith('did:')) {
    throw new Error('Expected DID as argument')
  }

  const memoryStore = new MemoryBlockstore()
  const rev = TID.nextStr()
  const commit = await ctx.actorStore.transact(did, async (store) => {
    const [records, existingCids] = await Promise.all([
      store.record.listAll(),
      store.record.listExistingBlocks(),
    ])
    let mst = await MST.create(memoryStore)
    for (const record of records) {
      mst = await mst.add(record.path, record.cid)
    }
    const newBlocks = new BlockMap()
    for await (const node of mst.walk()) {
      if (node.isTree()) {
        const pointer = await node.getPointer()
        if (!existingCids.has(pointer)) {
          const serialized = await node.serialize()
          newBlocks.set(serialized.cid, serialized.bytes)
        }
      }
    }
    const mstCids = await mst.allCids()
    const toDelete = new CidSet(existingCids.toList()).subtractSet(mstCids)
    const newCommit = await signCommit(
      {
        did,
        version: 3,
        rev,
        prev: null,
        data: await mst.getPointer(),
      },
      store.repo.signingKey,
    )
    const commitCid = await newBlocks.add(newCommit)

    console.log('Record count: ', records.length)
    console.log('Existing blocks: ', existingCids.toList().length)
    console.log('Deleting blocks:', toDelete.toList().length)
    console.log('Adding blocks: ', newBlocks.size)

    const shouldContinue = await promptContinue()
    if (!shouldContinue) {
      throw new Error('Aborted')
    }

    await store.repo.storage.deleteMany(toDelete.toList())
    await store.repo.storage.putMany(newBlocks, rev)
    await store.repo.storage.updateRoot(commitCid, rev)
    return {
      cid: commitCid,
      rev,
      since: null,
      prev: null,
      newBlocks,
      relevantBlocks: newBlocks,
      removedCids: toDelete,
      ops: [],
      blobs: new CidSet(),
      prevData: null,
    }
  })
  await ctx.accountManager.updateRepoRoot(did, commit.cid, rev)
  const syncData = await ctx.actorStore.read(did, (store) =>
    store.repo.getSyncEventData(),
  )
  await ctx.sequencer.sequenceSyncEvt(did, syncData)
}

const promptContinue = async (): Promise<boolean> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  const answer = await rl.question('Continue? y/n ')
  return answer === ''
}
