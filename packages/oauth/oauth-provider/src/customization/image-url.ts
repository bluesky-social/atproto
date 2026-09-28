import { z } from 'zod'

export const imageUrlSchema = z
  .string()
  .url()
  .refine(
    (url): url is `data:${string}` | `http://${string}` | `https://${string}` =>
      url.startsWith('data:') ||
      url.startsWith('http:') ||
      url.startsWith('https:'),
    {
      message: 'URL must start with data:, http:, or https:',
    },
  )
