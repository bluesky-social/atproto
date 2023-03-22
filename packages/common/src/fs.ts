import fs from 'fs/promises'
import { isErrnoException } from './util'

export const fileExists = async (location: string): Promise<boolean> => {
  try {
    await fs.access(location, fs.constants.F_OK)
    return true
  } catch (err) {
    if (isErrnoException(err) && err.code === 'ENOENT') {
      return false
    }
    throw err
  }
}
