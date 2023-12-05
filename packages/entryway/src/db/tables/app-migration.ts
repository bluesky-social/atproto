export interface AppMigration {
  id: string
  success: 0 | 1
  completedAt: string | null
}

export const tableName = 'app_migration'

export type PartialDB = { [tableName]: AppMigration }
