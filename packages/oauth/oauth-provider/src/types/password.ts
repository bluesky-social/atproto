import { z } from 'zod'

export const oldPasswordSchema = z.string().min(1).max(512)
export const newPasswordSchema = z.string().min(8).max(256)
