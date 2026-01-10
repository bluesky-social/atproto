import { ZodError } from 'zod'
import { formatZodError } from './zod-error.js'

export function formatError(err: unknown, prefix: string): string {
  if (err instanceof ZodError) return formatZodError(err, prefix)
  return prefix
}
