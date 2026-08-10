import { PDS } from '@atproto/pds'

void PDS.run().catch((err) => {
  // @NOTE we don't want to let the error propagate to the UnhandledRejection
  // handler, because that would cause Node to exit, which won't allow telemetry
  // to flush. Instead, we log the error and set the exit code.
  console.error('PDS failed to start:', err)
  process.exitCode = 1

  // In case the some resource were not properly cleaned up, we force exit after
  // a short delay. This is a last resort, and should not be necessary if the
  // PDS is implemented correctly. The delay is to give the telemetry a chance
  // to flush.
  setTimeout(() => process.exit(process.exitCode || 1), 5000).unref()
})
