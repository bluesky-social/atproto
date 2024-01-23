import Database from './db'

export class SignupLimiter {
  constructor(public db: Database) {}

  hasAvailability(): boolean {
    return true
  }
}
