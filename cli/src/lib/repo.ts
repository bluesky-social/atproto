import path from 'path'
import { promises as fsp } from 'fs'
import { UserStore, MemoryDB } from '@bluesky-demo/common'
import * as ucan from 'ucans'

export interface AccountJson {
  name: string
  server: string
  did: string
}

export interface Repo {
  keypair: ucan.EdKeypair
  account: AccountJson
  store: UserStore
}

export async function writeNewRepo (repoPath: string, secretKeyStr: string, carFileBuf: Uint8Array, accountJson: AccountJson) {
  // TODO- correct?
  await fsp.writeFile(path.join(repoPath, 'scdp.key'), secretKeyStr, 'utf-8')
  await fsp.writeFile(path.join(repoPath, 'blocks.car'), carFileBuf)
  await fsp.writeFile(path.join(repoPath, 'account.json'), JSON.stringify(accountJson, null, 2), 'utf-8')
}

export async function writeRepo (repoPath: string, repo: Repo) {
  await fsp.writeFile(path.join(repoPath, 'blocks.car'), await repo.store.getCarFile())
}

export async function readRepo (repoPath: string): Promise<Repo> {
  const secretKeyStr = await readFile(repoPath, 'scdp.key', 'utf-8') as string
  const carFileBuf = await readFile(repoPath, 'blocks.car') as Uint8Array
  const account = await readAccountFile(repoPath, 'account.json')
  const keypair = ucan.EdKeypair.fromSecretKey(secretKeyStr)
  return {
    keypair,
    account,
    store: await UserStore.fromCarFile(carFileBuf, MemoryDB.getGlobal(), keypair)
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