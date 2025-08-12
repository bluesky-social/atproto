import { ServerResponse } from 'node:http'

/**
 * Set or appends a value to the `Vary` header in the response, only if the
 * value is not already present.
 */
export function appendVary(res: ServerResponse, value: string) {
  if (!varyContains(res, value.toLowerCase())) {
    res.appendHeader('Vary', value)
  }
}

function varyContains(res: ServerResponse, searchValue: string) {
  const headerValue = res.getHeader('Vary')
  switch (typeof headerValue) {
    case 'string':
      return varyStringContains(headerValue, searchValue)
    case 'object':
      // headerValue is a string[] here
      return headerValue.some((h) => varyStringContains(h, searchValue))
    default:
      return false
  }
}

function varyStringContains(headerValue: string, searchValue: string): boolean {
  return headerValue
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .some((v) => v === searchValue || v === `*`)
}
