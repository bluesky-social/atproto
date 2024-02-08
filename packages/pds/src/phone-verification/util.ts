import { InvalidRequestError } from '@atproto/xrpc-server'

export interface PhoneVerifier {
  sendCode(phoneNumber: string): Promise<void>
  verifyCode(phoneNumber: string, code: string): Promise<boolean>
}

export const normalizePhoneNumber = (phoneNumber: string) => {
  let normalized = phoneNumber.trim().replaceAll(/\(|\)|-| /g, '')
  if (!normalized.startsWith('+')) {
    if (normalized.length === 10) {
      normalized = '+1' + normalized
    } else {
      normalized = '+' + normalized
    }
  }
  // https://www.twilio.com/docs/glossary/what-e164#regex-matching-for-e164
  const valid = /^\+[1-9]\d{1,14}$/.test(normalized)
  if (!valid) {
    throw new InvalidRequestError('Invalid phone number')
  }
  return normalized
}
