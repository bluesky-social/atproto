import {
  link,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  acquireSweepLock,
  sweepStaleReservations,
} from '../../dev-env/src/get-port.js'

describe('test port reservations', () => {
  let lockDir: string

  beforeEach(async () => {
    lockDir = await mkdtemp(join(tmpdir(), 'atproto-get-port-test-'))
  })

  afterEach(async () => {
    await rm(lockDir, { recursive: true, force: true })
  })

  const createOwner = async (name: string, pid = process.pid) => {
    const path = join(lockDir, name)
    await writeFile(path, String(pid))
    return path
  }

  it('allows only one stale-lock sweep at a time', async () => {
    const firstOwner = await createOwner('.owner-first')
    const secondOwner = await createOwner('.owner-second')

    const releaseFirst = await acquireSweepLock(lockDir, firstOwner, 100)
    expect(releaseFirst).toBeDefined()
    await expect(
      acquireSweepLock(lockDir, secondOwner, 100),
    ).resolves.toBeUndefined()
    await expect(
      acquireSweepLock(lockDir, secondOwner, 101),
    ).resolves.toBeUndefined()

    await releaseFirst?.()
    const releaseSecond = await acquireSweepLock(lockDir, secondOwner, 101)
    expect(releaseSecond).toBeDefined()
    await releaseSecond?.()
  })

  it('reaps stale port and owner links without touching live owners', async () => {
    const currentOwner = await createOwner('.owner-current')
    const otherLiveOwner = await createOwner('.owner-live')
    const staleOwner = await createOwner('.owner-stale', 999_999)
    await link(staleOwner, join(lockDir, '4100'))
    await link(otherLiveOwner, join(lockDir, '4200'))

    await sweepStaleReservations(lockDir, currentOwner)

    const entries = await readdir(lockDir)
    expect(entries).toEqual(
      expect.arrayContaining(['.owner-current', '.owner-live', '4200']),
    )
    expect(entries).not.toEqual(
      expect.arrayContaining(['.owner-stale', '4100']),
    )
    await expect(readFile(join(lockDir, '4200'), 'utf8')).resolves.toBe(
      String(process.pid),
    )
  })
})
