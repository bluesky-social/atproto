import { Permission } from './permission.js'

export type PermissionSetOptions = {
  title?: string
  'title:lang'?: Record<string, undefined | string>
  detail?: string
  'detail:lang'?: Record<string, undefined | string>
}

export class PermissionSet<
  const Nsid extends string = any,
  const Permissions extends readonly Permission[] = any,
  const Options extends PermissionSetOptions = any,
> {
  readonly lexiconType = 'permission-set' as const

  constructor(
    readonly nsid: Nsid,
    readonly permissions: Permissions,
    readonly options: Options,
  ) {}
}
