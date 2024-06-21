import { RuntimeLock } from './runtime-implementation.js'

const locks = new Map<unknown, Promise<void>>()

function acquireLocalLock(name: unknown): Promise<() => void> {
  return new Promise((resolveAcquire) => {
    const prev = locks.get(name) ?? Promise.resolve()
    const next = prev.then(() => {
      return new Promise<void>((resolveRelease) => {
        const release = () => {
          // Only delete the lock if it is still the current one
          if (locks.get(name) === next) locks.delete(name)

          resolveRelease()
        }

        resolveAcquire(release)
      })
    })

    locks.set(name, next)
  })
}

export const requestLocalLock: RuntimeLock = (name, fn) => {
  return acquireLocalLock(name).then(async (release) => {
    try {
      return await fn()
    } finally {
      release()
    }
  })
}
