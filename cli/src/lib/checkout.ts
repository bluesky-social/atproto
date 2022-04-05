import path from 'path'
import { promises as fsp } from 'fs'
import { Repo, IpldStore, service } from '@bluesky-demo/common'
import { CID } from 'multiformats/cid'
import * as ucan from 'ucans'

export interface AccountJson {
  name: string
  server: string
  did: string
}

export class Checkout {
  constructor(
    public path: string,
    public keypair: ucan.EdKeypair,
    public account: AccountJson,
    public blockstore: IpldStore,
  ) {}

  static async createNew(
    repoPath: string,
    name: string,
    server: string,
  ): Promise<Checkout> {
    try {
      await fsp.mkdir(repoPath, { recursive: true })
    } catch (e) {
      console.error(`Failed to create repo at ${repoPath}`)
      console.error(e)
      process.exit(1)
    }

    const keypair = await ucan.EdKeypair.create({ exportable: true })
    const userDID = keypair.did()
    const account: AccountJson = {
      name,
      server,
      did: userDID,
    }

    const blockstore = IpldStore.createPersistent(
      path.join(repoPath, 'blockstore'),
    )
    await fsp.writeFile(
      path.join(repoPath, 'scdp.key'),
      await keypair.export(),
      'utf-8',
    )
    await fsp.writeFile(
      path.join(repoPath, 'account.json'),
      JSON.stringify(account, null, 2),
      'utf-8',
    )
    // @TODO: Need a UCAN here
    const ucanStore = await ucan.Store.fromTokens([])
    const did = '@TODO'
    const repo = await Repo.create(blockstore, did, keypair, ucanStore)
    const checkout = new Checkout(repoPath, keypair, account, blockstore)
    await checkout.putRootCid(repo.cid)
    return checkout
  }

  static async load(repoPath: string): Promise<Checkout> {
    const secretKeyStr = (await readFile(
      repoPath,
      'scdp.key',
      'utf-8',
    )) as string
    const account = await readAccountFile(repoPath, 'account.json')
    const blockstore = IpldStore.createPersistent(
      path.join(repoPath, 'blockstore'),
    )
    const keypair = ucan.EdKeypair.fromSecretKey(secretKeyStr)
    return new Checkout(repoPath, keypair, account, blockstore)
  }

  async getLocalRepo(): Promise<Repo> {
    // @TODO: Need a UCAN here
    const ucanStore = await ucan.Store.fromTokens([])
    return Repo.load(
      this.blockstore,
      await this.getRootCid(),
      this.keypair,
      ucanStore,
    )
  }

  // async getUserStore(id: string): Promise<UserStore> {
  //   const did = id.startsWith('did:') ? id : await service.fetchUserDid(id)
  //   if (did) {
  //     const carFile = await service.fetchUser(did)
  //     return UserStore.fromCarFile(carFile, this.blockstore, this.keypair) // @TODO !!!! only pass in keypair if this is the local user! (waiting on PR to make keypair optional)
  //   } else {
  //     throw new Error(`User "${id}" not found`)
  //   }
  // }

  async getRootCid() {
    const str = await fsp.readFile(path.join(this.path, 'root.cid'), 'utf-8')
    if (!str) throw new Error(`No root.cid file found`)
    return CID.parse(str)
  }

  async putRootCid(cid: CID) {
    await fsp.writeFile(
      path.join(this.path, 'root.cid'),
      cid.toString(),
      'utf-8',
    )
  }

  async transact<T>(fn: (repo: Repo) => Promise<T>): Promise<T> {
    const repo = await this.getLocalRepo()
    const res = await fn(repo)
    await this.putRootCid(repo.cid)
    return res
  }

  async uploadToServer(repo?: Repo): Promise<void> {
    repo = repo || (await this.getLocalRepo())
    const blueskyDid = await service.getServerDid()
    // @TODO use a new UCAN here
    const token = await ucan.build({
      audience: blueskyDid,
      issuer: this.keypair,
      capabilities: [
        {
          bluesky: this.account.name,
          cap: 'POST',
        },
      ],
    })
    // @TODO fix updload
    // await service.updateUser(await repo.getCarFile(), ucan.encode(token))
  }
}

async function readFile(
  repoPath: string,
  filename: string,
  encoding?: BufferEncoding,
) {
  try {
    const value = await fsp.readFile(path.join(repoPath, filename), encoding)
    if (!value) throw new Error(`${filename} file not found`)
    return value
  } catch (e: any) {
    console.error(`Failed to read ${filename} file`)
    console.error(e.toString())
    process.exit(1)
  }
}

async function readAccountFile(
  repoPath: string,
  filename: string,
): Promise<AccountJson> {
  const str = (await readFile(repoPath, filename, 'utf-8')) as string
  let obj
  try {
    obj = JSON.parse(str)
    if (!obj.name || typeof obj.name !== 'string')
      throw new Error('"name" is invalid')
    if (!obj.server || typeof obj.server !== 'string')
      throw new Error('"server" is invalid')
    if (!obj.did || typeof obj.did !== 'string')
      throw new Error('"did" is invalid')
  } catch (e: any) {
    console.error(`Failed to load ${filename} file`)
    console.error(e.toString())
    process.exit(1)
  }
  return obj as AccountJson
}

export default Checkout
