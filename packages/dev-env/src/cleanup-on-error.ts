/**
 * Runs `fn`, which calls `onError` right after acquiring each resource it
 * needs. If `fn` throws, the registered cleanups run, most recent first, and
 * the original error is rethrown. Errors thrown by the cleanups are ignored so
 * they don't mask it.
 *
 * @example
 * return withCleanupOnError(async (onError) => {
 *   const plc = await TestPlc.create({})
 *   onError(() => plc.close())
 *   const pds = await TestPds.create({ didPlcUrl: plc.url })
 *   onError(() => pds.close())
 *   return { plc, pds }
 * })
 */
export async function withCleanupOnError<T>(
  fn: (onError: (cleanup: () => unknown) => void) => Promise<T>,
): Promise<T> {
  const cleanups: Array<() => unknown> = []
  try {
    return await fn((cleanup) => {
      cleanups.push(cleanup)
    })
  } catch (err) {
    for (const cleanup of cleanups.reverse()) {
      try {
        await cleanup()
      } catch {
        // @NOTE ignored, so that the original error is the one rethrown
      }
    }
    throw err
  }
}
