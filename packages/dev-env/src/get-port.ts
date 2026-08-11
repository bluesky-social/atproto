import { randomUUID } from 'node:crypto'
import { unlinkSync } from 'node:fs'
import {
  link,
  mkdir,
  readFile,
  readdir,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import getAvailablePort from 'get-port'

const lockDir = join(
  tmpdir(),
  `atproto-dev-env-ports-${process.getuid?.() ?? 'unknown'}`,
)
const claimedPorts = new Set<string>()
const ownerPath = join(lockDir, `.owner-${process.pid}-${randomUUID()}`)

let initialize: Promise<void> | undefined

const isProcessRunning = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return err?.['code'] !== 'ESRCH'
  }
}

const initializeLockDir = async () => {
  await mkdir(lockDir, { recursive: true })
  await writeFile(ownerPath, String(process.pid), { flag: 'wx' })

  const entries = await readdir(lockDir)
  await Promise.all(
    entries
      .filter((entry) => /^\d+$/.test(entry))
      .map(async (entry) => {
        const lockPath = join(lockDir, entry)
        try {
          const pid = Number.parseInt(await readFile(lockPath, 'utf8'), 10)
          if (!Number.isSafeInteger(pid) || !isProcessRunning(pid)) {
            await unlink(lockPath)
          }
        } catch (err) {
          if (err?.['code'] !== 'ENOENT') throw err
        }
      }),
  )
}

process.once('exit', () => {
  for (const lockPath of claimedPorts) {
    try {
      unlinkSync(lockPath)
    } catch {
      // The process is already exiting, so cleanup is best effort.
    }
  }
  try {
    unlinkSync(ownerPath)
  } catch {
    // The process is already exiting, so cleanup is best effort.
  }
})

export default async function getPort(): Promise<number> {
  initialize ??= initializeLockDir()
  await initialize

  while (true) {
    const port = await getAvailablePort()
    const lockPath = join(lockDir, String(port))

    try {
      await link(ownerPath, lockPath)
      claimedPorts.add(lockPath)
      return port
    } catch (err) {
      if (err?.['code'] !== 'EEXIST') throw err
    }
  }
}
