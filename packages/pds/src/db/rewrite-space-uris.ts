import { type Kysely, sql } from 'kysely'

// Space URIs moved from `at://{spaceDid}/space/{rest}` to
// `at:space/{spaceDid}/{rest}`. This rewrites stored URIs in place between the
// two forms, for the migrations that make that move.
//
// Each statement only touches values still in the source form, so a run that
// stops part-way (Kysely doesn't wrap SQLite migrations in a transaction)
// finishes when it runs again. A DID contains no `/`, so the first `/` after the
// scheme always ends the space DID.

export type SpaceUriColumn = readonly [table: string, column: string]

export async function rewriteSpaceUris(
  db: Kysely<unknown>,
  columns: readonly SpaceUriColumn[],
  direction: 'up' | 'down',
): Promise<void> {
  for (const [table, column] of columns) {
    const query =
      direction === 'up' ? toNewForm(table, column) : toOldForm(table, column)
    await query.execute(db)
  }
}

// at://{spaceDid}/space/{rest} -> at:space/{spaceDid}/{rest}
function toNewForm(table: string, column: string) {
  const uri = sql.ref(column)
  // The `/` ending the DID, counted from the start of the DID (index 6).
  const slash = sql`instr(substr(${uri}, 6), '/')`
  return sql`
    update ${sql.table(table)}
    set ${uri} = 'at:space/' || substr(${uri}, 6, ${slash} - 1) || '/'
      || substr(${uri}, ${slash} + 12)
    where substr(${uri}, 1, 5) = 'at://'
      and substr(${uri}, ${slash} + 5, 7) = '/space/'
  `
}

// at:space/{spaceDid}/{rest} -> at://{spaceDid}/space/{rest}
function toOldForm(table: string, column: string) {
  const uri = sql.ref(column)
  // The `/` ending the DID, counted from the start of the DID (index 10).
  const slash = sql`instr(substr(${uri}, 10), '/')`
  return sql`
    update ${sql.table(table)}
    set ${uri} = 'at://' || substr(${uri}, 10, ${slash} - 1) || '/space/'
      || substr(${uri}, ${slash} + 10)
    where substr(${uri}, 1, 9) = 'at:space/'
      and ${slash} > 0
  `
}
