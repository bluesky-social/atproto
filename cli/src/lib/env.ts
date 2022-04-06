import os from 'os'
import path from 'path'

export const REPO_PATH = expandPath(process.env.SKY_REPO_PATH || `~/.sky`)

function expandPath(str: string) {
  if (str.startsWith('~')) {
    str = path.join(os.homedir(), str.slice(1))
  }
  return path.resolve(str)
}
