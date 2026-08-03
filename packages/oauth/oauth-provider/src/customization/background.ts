import { z } from 'zod'

// Light- and dark-mode background image URLs for the authorization screens.
export const backgroundsSchema = z.object({
  light: z.string().url().optional(),
  dark: z.string().url().optional(),
})
export type Backgrounds = z.infer<typeof backgroundsSchema>
