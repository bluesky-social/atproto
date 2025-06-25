// NOTE this file can be edited by hand, but it is also appended to by the migration:create command.
// It's important that every migration is exported from here with the proper name. We'd simplify
// this with kysely's FileMigrationProvider, but it doesn't play nicely with the build process.

export * as _20240108T220751294Z from './20240108T220751294Z-init'
export * as _20240717T224303472Z from './20240717T224303472Z-notif-ops'
export * as _20250527T022203400Z from './20250527T022203400Z-add-operation'
export * as _20250603T163446567Z from './20250603T163446567Z-alter-operation'
