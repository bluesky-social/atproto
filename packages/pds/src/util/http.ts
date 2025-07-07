import { ServerResponse } from 'node:http'

export function appendVary(res: ServerResponse, value: string) {
  const current = res.getHeader('Vary')
  if (current == null || typeof current === 'number') {
    res.setHeader('Vary', value)
  } else {
    const alreadyIncluded = Array.isArray(current)
      ? current.some((value) => value.includes(value))
      : current.includes(value)
    if (!alreadyIncluded) {
      res.appendHeader('Vary', value)
    }
  }
}
