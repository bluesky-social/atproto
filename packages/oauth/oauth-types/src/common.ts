import { TypeOf, z } from 'zod'

export const urlSchema = z
  .string()
  .refine(
    (data): data is `${string}:${string}` =>
      URL.canParse(data) && data.includes(':'),
    {
      message: 'Invalid URL',
    },
  )

export const webUrlSchema = urlSchema.refine(
  (data): data is `http://${string}` | `https://${string}` =>
    data.startsWith('http://') || data.startsWith('https://'),
  {
    message: 'URL must use the "https:" or "http:" protocol',
  },
)

export type WebUrl = TypeOf<typeof webUrlSchema>
