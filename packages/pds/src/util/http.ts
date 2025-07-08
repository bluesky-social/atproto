import { ServerResponse } from 'node:http'

/**
 * Set or appends a value to the `Vary` header in the response, only if the
 * value is not already present.
 */
export function appendVary(res: ServerResponse, value: string) {
  if (!headerContains(res.getHeader('Vary'), value, ',')) {
    res.appendHeader('Vary', value)
  }
}

function headerContains(
  headerValue: undefined | number | string | string[],
  searchValue: string,
  separator: string | null,
) {
  switch (typeof headerValue) {
    case 'string':
      return separator
        ? headerValue.split(separator).some((v) => v.trim() === searchValue)
        : headerValue.trim() === searchValue
    case 'number':
      return String(headerValue) === searchValue
    case 'object':
      return headerValue.some((h) => headerContains(h, searchValue, separator))
    default:
      return false
  }
}
