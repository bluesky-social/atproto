import type { IncomingMessage } from 'node:http'

export type MethodMatcherInput = string | Iterable<string> | MethodMatcher
export type MethodMatcher = (req: IncomingMessage) => boolean

export function createMethodMatcher(method: MethodMatcherInput): MethodMatcher {
  if (method === '*') return () => true
  if (typeof method === 'function') return method

  if (typeof method === 'string') {
    method = method.toUpperCase()
    return (req) => req.method === method
  }

  const set = new Set(Array.from(method, (m) => m.toUpperCase()))
  if (set.size === 0) return () => false
  return (req) => req.method != null && set.has(req.method)
}
