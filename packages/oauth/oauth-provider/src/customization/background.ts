import { z } from 'zod'

/**
 * Light- and dark-mode background images for the authorization screens. Each is
 * an image URL; the active one is picked by the visitor's `prefers-color-scheme`,
 * matching how the rest of the UI handles dark mode (system-driven, no toggle).
 */
export const backgroundsSchema = z.object({
  light: z.string().url().optional(),
  dark: z.string().url().optional(),
})
export type Backgrounds = z.infer<typeof backgroundsSchema>
