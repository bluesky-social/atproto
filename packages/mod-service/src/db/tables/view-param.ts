// @NOTE postgres-only
export const tableName = 'view_param'

// materialized views are difficult to change,
// so we parameterize them at runtime with contents of this table.
// its contents are set in migrations, available param names are static.
export interface ViewParam {
  name: string
  value: string
}

export type PartialDB = { [tableName]: ViewParam }
