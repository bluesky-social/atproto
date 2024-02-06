import { constants } from 'node:fs'
import { access, readFile, rm } from 'node:fs/promises'

import { isErrnoException } from '@atproto/common-web'

export const fileExists = async (location: string): Promise<boolean> => {
  try {
    await access(location, constants.F_OK)
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
    return await readFile(filepath)
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
    await rm(filepath, { recursive })
  } catch (err) {
    if (isErrnoException(err) && err.code === 'ENOENT') {
      return
    }
    throw err
  }
}
