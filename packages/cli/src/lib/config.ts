import path from 'path'
import { promises as fsp } from 'fs'
import * as auth from '@atproto/auth'
import { CID } from 'multiformats/cid'

export type AccountJson = {
  username: string
  server: string
  delegator: boolean
}

export type Config = {
  account: AccountJson
  authStore: auth.AuthStore
  root: CID | null
}

export const writeCfg = async (
  repoPath: string,
  username: string,
  server: string,
  delegator: boolean,
) => {
  try {
    await fsp.mkdir(repoPath, { recursive: true })
  } catch (e) {
    throw new Error(`Failed to create repo at ${repoPath}`)
  }

  const keypair = await auth.EcdsaKeypair.create({ exportable: true })
  const authStore = new auth.AuthStore(keypair, [])
  const fullToken = await authStore.claimFull()

  const exportedKey = JSON.stringify(await keypair.export())

  const serverCleaned = cleanHost(server)

  const account: AccountJson = {
    username,
    server: serverCleaned,
    delegator,
  }
  await fsp.writeFile(path.join(repoPath, 'atp.key'), exportedKey, 'utf-8')
  await fsp.writeFile(
    path.join(repoPath, 'account.json'),
    JSON.stringify(account, null, 2),
    'utf-8',
  )
  await fsp.writeFile(
    path.join(repoPath, 'full.ucan'),
    auth.encodeUcan(fullToken),
    'utf-8',
  )
}

export const cfgExists = async (repoPath: string): Promise<boolean> => {
  try {
    await loadCfg(repoPath)
    return true
  } catch (_) {
    return false
  }
}

export const loadCfg = async (repoPath: string): Promise<Config> => {
  const account = await readAccountFile(repoPath, 'account.json')
  const jwkStr = (await readFile(repoPath, 'atp.key', 'utf-8')) as string
  const jwk = JSON.parse(jwkStr)
  const keypair = await auth.EcdsaKeypair.import(jwk)
  const tokenStr = (await readFile(repoPath, 'full.ucan', 'utf-8')) as string
  const authStore = new auth.AuthStore(keypair, [tokenStr])
  const root = await readRoot(repoPath)
  return {
    account,
    authStore,
    root,
  }
}

const readFile = async (
  repoPath: string,
  filename: string,
  encoding?: BufferEncoding,
): Promise<string | Buffer> => {
  const value = await fsp.readFile(path.join(repoPath, filename), encoding)
  if (!value) throw new Error(`${filename} file not found`)
  return value
}

const readAccountFile = async (
  repoPath: string,
  filename: string,
): Promise<AccountJson> => {
  const str = (await readFile(repoPath, filename, 'utf-8')) as string
  const obj = JSON.parse(str)
  const { username, server, delegator } = obj
  if (!username || typeof username !== 'string')
    throw new Error('"username" is invalid')
  if (!server || typeof server !== 'string')
    throw new Error('"server" is invalid')
  if (typeof delegator !== 'boolean') throw new Error('"delegator" is invalid')
  const serverCleaned = cleanHost(server)
  return { username, server: serverCleaned, delegator }
}

export const readRoot = async (repoPath: string): Promise<CID | null> => {
  try {
    const rootStr = await fsp.readFile(path.join(repoPath, 'root'), 'utf-8')
    return rootStr ? CID.parse(rootStr) : null
  } catch (_) {
    return null
  }
}

export const writeRoot = async (repoPath: string, cid: CID): Promise<void> => {
  await fsp.writeFile(path.join(repoPath, 'root'), cid.toString(), 'utf-8')
}

const cleanHost = (str: string): string => {
  return str.replace('http://', '').replace('https://', '')
}

export const destroy = async (repoPath: string) => {
  await fsp.rm(repoPath, { recursive: true })
}
