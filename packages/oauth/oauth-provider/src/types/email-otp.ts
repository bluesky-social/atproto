import { z } from 'zod'

export const emailOtpSchema = z
  .string()
  .regex(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/, 'Invalid token format')
