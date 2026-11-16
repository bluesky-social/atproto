import migrations from './migrations/index.js'

/** The newest actor-store migration this version knows. */
export const LATEST_ACTOR_MIGRATION: string = Object.keys(migrations).reduce(
  (latest, name) => (name.localeCompare(latest) > 0 ? name : latest),
)
