import { z } from 'zod'
import { hcaptchaConfigSchema } from '../lib/hcaptcha.js'
import { brandingSchema } from './branding.js'

export const customizationSchema = z.object({
  /**
   * Available user domains that can be used to sign up. A non-empty array
   * is required to enable the sign-up feature.
   */
  availableUserDomains: z.array(z.string()).optional(),
  /**
   * UI customizations
   */
  branding: brandingSchema.optional(),
  /**
   * Is an invite code required to sign up?
   */
  inviteCodeRequired: z.boolean().optional(),
  /**
   * Enables hCaptcha during sign-up.
   */
  hcaptcha: hcaptchaConfigSchema.optional(),
})
export type CustomizationInput = z.input<typeof customizationSchema>
export type Customization = z.infer<typeof customizationSchema>
