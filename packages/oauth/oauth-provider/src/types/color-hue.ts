import { z } from 'zod'

export const colorHueSchema = z.number().min(0).max(360)
