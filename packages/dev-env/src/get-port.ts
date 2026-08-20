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
import { basename, join } from 'node:path'
import getAvailablePort from 'get-port'

const SWEEP_INTERVAL_MS = 1_000
const SWEEP_LOCK_PATTERN = /^\.sweep-(\d+)$/
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

export const acquireSweepLock = async (
  lockDir: string,
  ownerPath: string,
  generation = Math.floor(Date.now() / SWEEP_INTERVAL_MS),
): Promise<(() => Promise<void>) | undefined> => {
  const sweepPath = join(lockDir, `.sweep-${generation}`)

  try {
    await link(ownerPath, sweepPath)
  } catch (err) {
    if (err?.['code'] === 'EEXIST') return
    throw err
  }

  try {
    const entries = await readdir(lockDir)
    for (const entry of entries) {
      const match = SWEEP_LOCK_PATTERN.exec(entry)
      if (!match || entry === basename(sweepPath)) continue

      const otherSweepPath = join(lockDir, entry)
      try {
        const pid = Number.parseInt(await readFile(otherSweepPath, 'utf8'), 10)
        if (Number.isSafeInteger(pid) && isProcessRunning(pid)) {
          await unlink(sweepPath)
          return
        }
        // Sweep generations are never reclaimed, so an inactive marker can
        // be removed without racing a new owner of the same path.
        await unlink(otherSweepPath)
      } catch (err) {
        if (err?.['code'] !== 'ENOENT') throw err
      }
    }

    return async () => {
      try {
        await unlink(sweepPath)
      } catch (err) {
        if (err?.['code'] !== 'ENOENT') throw err
      }
    }
  } catch (err) {
    try {
      await unlink(sweepPath)
    } catch (cleanupErr) {
      if (cleanupErr?.['code'] !== 'ENOENT') throw cleanupErr
    }
    throw err
  }
}

export const sweepStaleReservations = async (
  lockDir: string,
  ownerPath: string,
) => {
  const entries = await readdir(lockDir)
  await Promise.all(
    entries
      .filter(
        (entry) =>
          entry !== basename(ownerPath) &&
          (/^\d+$/.test(entry) || entry.startsWith('.owner-')),
      )
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

const initializeLockDir = async () => {
  await mkdir(lockDir, { recursive: true })
  await writeFile(ownerPath, String(process.pid), { flag: 'wx' })

  const releaseSweepLock = await acquireSweepLock(lockDir, ownerPath)
  if (!releaseSweepLock) return

  try {
    await sweepStaleReservations(lockDir, ownerPath)
  } finally {
    await releaseSweepLock()
  }
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
