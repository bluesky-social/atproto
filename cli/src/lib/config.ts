import path from 'path'
import { promises as fsp } from 'fs'
import * as ucan from 'ucans'
import { auth } from '@bluesky-demo/common'

export type AccountJson = {
  username: string
  server: string
}

export type Config = {
  keypair: ucan.EdKeypair
  account: AccountJson
  ucanStore: ucan.Store
}

export const writeCfg = async (
  repoPath: string,
  username: string,
  server: string,
) => {
  try {
    await fsp.mkdir(repoPath, { recursive: true })
  } catch (e) {
    console.error(`Failed to create repo at ${repoPath}`)
    console.error(e)
    process.exit(1)
  }

  const keypair = await ucan.EdKeypair.create({ exportable: true })
  const userDID = keypair.did()
  const fullToken = await auth.claimFull(keypair.did(), keypair)

  const account: AccountJson = {
    username,
    server,
  }
  await fsp.writeFile(
    path.join(repoPath, 'sky.key'),
    await keypair.export(),
    'utf-8',
  )
  await fsp.writeFile(
    path.join(repoPath, 'account.json'),
    JSON.stringify(account, null, 2),
    'utf-8',
  )
  await fsp.writeFile(
    path.join(repoPath, 'full.ucan'),
    fullToken.encoded(),
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
  const secretKeyStr = (await readFile(repoPath, 'sky.key', 'utf-8')) as string
  const keypair = ucan.EdKeypair.fromSecretKey(secretKeyStr)
  const tokenStr = (await readFile(repoPath, 'full.ucan', 'utf-8')) as string
  const ucanStore = await ucan.Store.fromTokens([tokenStr])
  return {
    account,
    keypair,
    ucanStore,
  }
}

const readFile = async (
  repoPath: string,
  filename: string,
  encoding?: BufferEncoding,
): Promise<string | Buffer> => {
  try {
    const value = await fsp.readFile(path.join(repoPath, filename), encoding)
    if (!value) throw new Error(`${filename} file not found`)
    return value
  } catch (e) {
    console.error(`Failed to read ${filename} file`)
    console.error(e)
    process.exit(1)
  }
}

const readAccountFile = async (
  repoPath: string,
  filename: string,
): Promise<AccountJson> => {
  const str = (await readFile(repoPath, filename, 'utf-8')) as string
  let obj
  try {
    obj = JSON.parse(str)
    if (!obj.username || typeof obj.username !== 'string')
      throw new Error('"username" is invalid')
    if (!obj.server || typeof obj.server !== 'string')
      throw new Error('"server" is invalid')
  } catch (e) {
    console.error(`Failed to load ${filename} file`)
    console.error(e)
    process.exit(1)
  }
  return obj as AccountJson
}

export const destroy = async (repoPath: string) => {
  await fsp.rm(repoPath, { recursive: true })
}
