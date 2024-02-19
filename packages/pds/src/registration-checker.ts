import express from 'express'
import DatabaseSchema from './db/database-schema'

export type RegistrationVerdict = {
  deny: boolean
  requirePhone: boolean
}

export type RegistrationInfo = {
  req: express.Request
  did: string
  nonce?: string
  phoneNumber?: string
}

export interface RegistrationChecker {
  checkReq(req: express.Request, nonce?: string): Promise<RegistrationVerdict>
  logRegistration(info: RegistrationInfo): Promise<void>
}

export type RegistrationCheckerCreator = (
  db: DatabaseSchema,
) => RegistrationChecker
