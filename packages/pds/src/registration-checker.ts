import express from 'express'
import DatabaseSchema from './db/database-schema'

export type RegistrationVerdict = {
  deny: boolean
  requirePhone: boolean
}

export type RegistrationInfo = {
  req: express.Request
  did: string
  phoneNumber?: string
}

export interface RegistrationChecker {
  checkReq(req: express.Request): Promise<RegistrationVerdict>
  logRegistration(info: RegistrationInfo): Promise<void>
}

export type RegistrationCheckerCreator = (
  db: DatabaseSchema,
) => RegistrationChecker
