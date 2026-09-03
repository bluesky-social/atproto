import assert from 'node:assert'
import type { OzoneEnvironment } from './env.js'

// Parses `name:value` pairs, e.g. `OZONE_PDS_HEADERS=x-example:abc,x-other:def`.
// Splits on the first colon only, so values may contain colons. Throws on a
// malformed entry rather than skipping it: these headers may carry
// credentials, and silently sending none is harder to notice than failing to
// boot. Values are never included in error messages.
const parsePdsHeaders = (
  entries?: string[],
): Record<string, string> | undefined => {
  if (!entries?.length) return undefined
  const headers: Record<string, string> = {}
  for (const entry of entries) {
    const separatorAt = entry.indexOf(':')
    assert(
      separatorAt > 0,
      'OZONE_PDS_HEADERS entries must be formatted as `name:value`',
    )
    const name = entry.slice(0, separatorAt).trim()
    const value = entry.slice(separatorAt + 1).trim()
    assert(name, 'OZONE_PDS_HEADERS entry is missing a header name')
    assert(value, `OZONE_PDS_HEADERS entry "${name}" is missing a value`)
    headers[name] = value
  }
  return headers
}

export const envToSecrets = (env: OzoneEnvironment): OzoneSecrets => {
  assert(env.adminPassword)
  assert(env.signingKeyHex)

  return {
    adminPassword: env.adminPassword,
    signingKeyHex: env.signingKeyHex,
    pdsHeaders: parsePdsHeaders(env.pdsHeaders),
  }
}

export type OzoneSecrets = {
  adminPassword: string
  signingKeyHex: string
  // Extra headers sent on every request to the *configured* PDS.
  pdsHeaders?: Record<string, string>
}
