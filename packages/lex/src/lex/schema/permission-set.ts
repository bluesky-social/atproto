import { LexPermission } from './permission.js'

export type LexPermissionSetOptions = {
  title?: string
  'title:lang'?: Record<string, undefined | string>
  detail?: string
  'detail:lang'?: Record<string, undefined | string>
}

export class LexPermissionSet<
  const Nsid extends string = any,
  const Permissions extends readonly LexPermission[] = any,
  const Options extends LexPermissionSetOptions = any,
> {
  constructor(
    readonly nsid: Nsid,
    readonly permissions: Permissions,
    readonly options: Options,
  ) {}
}
