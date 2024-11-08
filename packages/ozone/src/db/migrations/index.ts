// NOTE this file can be edited by hand, but it is also appended to by the migration:create command.
// It's important that every migration is exported from here with the proper name. We'd simplify
// this with kysely's FileMigrationProvider, but it doesn't play nicely with the build process.

export * as _20231219T205730722Z from './20231219T205730722Z-init'
export * as _20240116T085607200Z from './20240116T085607200Z-communication-template'
export * as _20240201T051104136Z from './20240201T051104136Z-mod-event-blobs'
export * as _20240208T213404429Z from './20240208T213404429Z-add-tags-column-to-moderation-subject'
export * as _20240228T003647759Z from './20240228T003647759Z-add-label-sigs'
export * as _20240408T192432676Z from './20240408T192432676Z-mute-reporting'
export * as _20240506T225055595Z from './20240506T225055595Z-message-subject'
export * as _20240430T211332580Z from './20240521T211332580Z-member'
export * as _20240814T003647759Z from './20240814T003647759Z-event-created-at-index'
export * as _20240903T205730722Z from './20240903T205730722Z-add-template-lang'
export * as _20240904T205730722Z from './20240904T205730722Z-add-subject-did-index'
export * as _20241001T205730722Z from './20241001T205730722Z-subject-status-review-state-index'
export * as _20241008T205730722Z from './20241008T205730722Z-sets'
export * as _20241018T205730722Z from './20241018T205730722Z-setting'
export * as _20241026T205730722Z from './20241026T205730722Z-add-hosting-status-to-subject-status'
