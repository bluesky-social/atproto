import { AccountService } from './account'
import { AuthService } from './auth'
import { ServiceDb } from '../service-db'

export function createServices(): Services {
  return {
    account: (db: ServiceDb) => new AccountService(db),
    auth: (db: ServiceDb) => new AuthService(db),
  }
}

export type Services = {
  account: FromDb<AccountService>
  auth: FromDb<AuthService>
}

type FromDb<T> = (db: ServiceDb) => T
