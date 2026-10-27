// Loads better-sqlite3 the way services do (see packages/pds/src/db/db.ts): as
// an ESM import with a bare specifier.
import SqliteDB from 'better-sqlite3'

const db = new SqliteDB(':memory:')
try {
  db.exec('SELECT 1')
  // As run by Kysely's SqliteDialect
  db.prepare('SELECT 2').all()
} finally {
  db.close()
}
