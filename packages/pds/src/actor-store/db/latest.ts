import { latestMigrationName } from '../../db/index.js'
import migrations from './migrations/index.js'

const latest = latestMigrationName(migrations)
if (latest === undefined) throw new Error('No actor-store migrations')

/** The newest actor-store migration this version knows. */
export const LATEST_ACTOR_MIGRATION: string = latest
