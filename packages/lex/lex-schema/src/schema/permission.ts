import { Params } from './_parameters.js'

export type PermissionOptions = Params

export class Permission<
  const Resource extends string = any,
  const Options extends PermissionOptions = any,
> {
  readonly lexiconType = 'permission' as const

  constructor(
    readonly resource: Resource,
    readonly options: Options,
  ) {}
}
