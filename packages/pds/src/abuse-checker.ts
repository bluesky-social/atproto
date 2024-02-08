import express from 'express'

export type AbuseVerdict = {
  deny: boolean
  requirePhone: boolean
}

export type RegistrationInfo = {
  req: express.Request
  did: string
  phoneNumber?: string
}

export interface AbuseChecker {
  checkReq(req: express.Request): Promise<AbuseVerdict>
  logRegistration(info: RegistrationInfo): Promise<void>
}
