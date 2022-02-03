import path from 'path'
import { promises as fsp } from 'fs'
import { UserStore, Blockstore } from '@bluesky-demo/common'
import { CID } from 'multiformats/cid'
import * as ucan from 'ucans'

export interface AccountJson {
  name: string
  server: string
  did: string
}

export class Repo {
  constructor(
    public keypair: ucan.EdKeypair,
    public account: AccountJson,
    public blockstore: Blockstore,
    public rootCidFile: RootCidFile
  ) {}

  static async createNew (repoPath: string, name: string, server: string): Promise<Repo> {
    try {
      await fsp.mkdir(repoPath, {recursive: true})
    } catch (e: any) {
      console.error(`Failed to create repo at ${repoPath}`)
      console.error(e.toString())
      process.exit(1)
    }
  
    const keypair = await ucan.EdKeypair.create({exportable: true})
    const userDID = keypair.did()
    const account: AccountJson = {
      name,
      server,
      did: userDID
    }
    
    const blockstore = new Blockstore(path.join(repoPath, 'blockstore'))
    await fsp.writeFile(path.join(repoPath, 'scdp.key'), await keypair.export(), 'utf-8')
    await fsp.writeFile(path.join(repoPath, 'account.json'), JSON.stringify(account, null, 2), 'utf-8')
    const rootCidFile = new RootCidFile(path.join(repoPath, 'root.cid'))
  
    const localUserStore = await UserStore.create(name, blockstore, keypair)
    await rootCidFile.put(localUserStore.root)
  
    return new Repo(
      keypair,
      account,
      blockstore,
      rootCidFile
    )
  }

  static async load (repoPath: string): Promise<Repo> {
    const secretKeyStr = await readFile(repoPath, 'scdp.key', 'utf-8') as string
    const account = await readAccountFile(repoPath, 'account.json')
    const blockstore = new Blockstore(path.join(repoPath, 'blockstore'))
    const keypair = ucan.EdKeypair.fromSecretKey(secretKeyStr)
    const rootCidFile = new RootCidFile(path.join(repoPath, 'root.cid'))
    return new Repo(
      keypair,
      account,
      blockstore,
      rootCidFile
    )
  }

  async getLocalUserStore (): Promise<UserStore> {
    return this.getUserStore(await this.rootCidFile.get())
  }

  async getUserStore (cid: CID): Promise<UserStore> {
    return UserStore.get(cid, this.blockstore, this.keypair) // TODO !!!! only pass in keypair if this is the local user! (waiting on PR to make keypair optional)
  }
}

class RootCidFile {
  constructor (public path: string) {}
  async get () {
    const str = await fsp.readFile(this.path, 'utf-8')
    if (!str) throw new Error(`No root.cid file found`)
    return CID.parse(str)
  }
  async put (cid: CID) {
    await fsp.writeFile(this.path, cid.toString(), 'utf-8')
  }
}

async function readFile (repoPath: string, filename: string, encoding?: BufferEncoding) {
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

async function readAccountFile (repoPath: string, filename: string): Promise<AccountJson> {
  const str = await readFile(repoPath, filename, 'utf-8') as string
  let obj
  try {
    obj = JSON.parse(str)
    if (!obj.name || typeof obj.name !== 'string') throw new Error('"name" is invalid')
    if (!obj.server || typeof obj.server !== 'string') throw new Error('"server" is invalid')
    if (!obj.did || typeof obj.did !== 'string') throw new Error('"did" is invalid')
  } catch (e: any) {
    console.error(`Failed to load ${filename} file`)
    console.error(e.toString())
    process.exit(1)
  }
  return obj as AccountJson
}