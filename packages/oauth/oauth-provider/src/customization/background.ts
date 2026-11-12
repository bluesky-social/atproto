import { z } from 'zod'
import { imageUrlSchema } from './image-url.js'

// Light- and dark-mode background image URLs for the authorization screens.
export const backgroundsSchema = z.object({
  light: imageUrlSchema.optional(),
  dark: imageUrlSchema.optional(),
})
export type Backgrounds = z.infer<typeof backgroundsSchema>
