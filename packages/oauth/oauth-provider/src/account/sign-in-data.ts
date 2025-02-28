import { z } from 'zod'
import { authenticateAccountDataSchema } from './account-store.js'

export const signInDataSchema = authenticateAccountDataSchema
  .extend({
    /**
     * If false, the account must not be returned from
     * {@link AccountStore.listDeviceAccounts}. Note that this only makes sense when
     * used with a device ID.
     */
    remember: z.boolean().optional().default(false),
  })
  .strict()

export type SignInData = z.TypeOf<typeof signInDataSchema>
