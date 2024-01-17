export interface PhoneVerification {
  did: string
  phoneNumber: string
}

export const tableName = 'phone_verification'

export type PartialDB = { [tableName]: PhoneVerification }
