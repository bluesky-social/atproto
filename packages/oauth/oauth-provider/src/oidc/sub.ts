import { z } from 'zod'

export const subSchema = z.string().min(1)
export type Sub = z.infer<typeof subSchema>
