import { TypeOf, z } from 'zod'

/**
 * Valid, but potentially dangerous URL (`data:`, `file:`, `javascript:`, etc.).
 *
 * Any value that matches this schema is safe to parse using `new URL()`.
 */
export const dangerousUrlSchema = z
  .string()
  .refine(
    (data): data is `${string}:${string}` =>
      data.includes(':') && URL.canParse(data),
    {
      message: 'Invalid URL',
    },
  )

/**
 * Valid, but potentially dangerous URL (`data:`, `file:`, `javascript:`, etc.).
 */
export type DangerousUrl = TypeOf<typeof dangerousUrlSchema>

export const webUrlSchema = dangerousUrlSchema.refine(
  (data): data is `http://${string}` | `https://${string}` =>
    data.startsWith('http://') || data.startsWith('https://'),
  {
    message: 'URL must use the "https:" or "http:" protocol',
  },
)

export type WebUrl = TypeOf<typeof webUrlSchema>
