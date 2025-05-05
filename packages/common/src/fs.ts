import { constants } from 'node:fs'
import fs from 'node:fs/promises'
import { isErrnoException } from '@atproto/common-web'

export const fileExists = async (location: string): Promise<boolean> => {
  try {
    await fs.access(location, constants.F_OK)
    return true
  } catch (err) {
    if (isErrnoException(err) && err.code === 'ENOENT') {
      return false
    }
    throw err
  }
}

export const readIfExists = async (
  filepath: string,
): Promise<Uint8Array | undefined> => {
  try {
    return await fs.readFile(filepath)
  } catch (err) {
    if (isErrnoException(err) && err.code === 'ENOENT') {
      return
    }
    throw err
  }
}

export const rmIfExists = async (
  filepath: string,
  recursive = false,
): Promise<void> => {
  try {
    await fs.rm(filepath, { recursive })
  } catch (err) {
    if (isErrnoException(err) && err.code === 'ENOENT') {
      return
    }
    throw err
  }
}

export const renameIfExists = async (
  oldPath: string,
  newPath: string,
): Promise<void> => {
  try {
    await fs.rename(oldPath, newPath)
  } catch (err) {
    if (isErrnoException(err) && err.code === 'ENOENT') {
      return
    }
    throw err
  }
}
