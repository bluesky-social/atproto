import type { AtpAgent } from '@atproto/api'
import { TID } from '@atproto/common'
import { Secp256k1Keypair } from '@atproto/crypto'
import { type SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import type { Cid } from '@atproto/lex-data'
import { BlockMap, blocksToCarFile, signCommit } from '@atproto/repo'
import type { DidString } from '@atproto/syntax'

// Builds a CAR whose MST has two nodes per level, each referencing both nodes
// of the level below. These repeated references do not form a valid tree.
const buildDagCar = async (did: string, depth: number) => {
  const blocks = new BlockMap()
  const enc = new TextEncoder()
  const value = await blocks.add({ $type: 'com.example.dummy' })
  const entry = (key: string, t: Cid | null) => ({
    p: 0,
    k: enc.encode(key),
    v: value,
    t,
  })
  let level: Cid[] = []
  for (let j = 0; j < 2; j++) {
    level.push(
      await blocks.add({ l: null, e: [entry(`com.example.lvl0/${j}`, null)] }),
    )
  }
  for (let i = 1; i < depth; i++) {
    const next: Cid[] = []
    for (let j = 0; j < 2; j++) {
      next.push(
        await blocks.add({
          l: level[j],
          e: [entry(`com.example.lvl${i}/${j}`, level[(j + 1) % 2])],
        }),
      )
    }
    level = next
  }
  const keypair = await Secp256k1Keypair.create()
  const commit = await signCommit(
    { did, version: 3, rev: TID.nextStr(), prev: null, data: level[0] },
    keypair,
  )
  const root = await blocks.add(commit)
  return blocksToCarFile(root, blocks)
}

describe('importRepo', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient
  let did: DidString

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'import_repo',
    })
    agent = network.pds.getAgent()
    sc = network.getSeedClient()
    const account = await sc.createAccount('alice', {
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    did = account.did
  })

  afterAll(async () => {
    await network?.close()
  })

  it('rejects a repo whose MST shares subtrees between parents', async () => {
    const car = await buildDagCar(did, 40)
    await expect(
      agent.com.atproto.repo.importRepo(car, {
        encoding: 'application/vnd.ipld.car',
        headers: sc.getHeaders(did),
      }),
    ).rejects.toMatchObject({
      status: 400,
      error: 'InvalidRequest',
    })

    // the server is still responsive and the existing repo is untouched
    const res = await agent.com.atproto.sync.getLatestCommit({ did })
    expect(res.success).toBe(true)
  })
})
