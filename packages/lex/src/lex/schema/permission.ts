import { Parameter } from './_parameters.js'

export type PermissionOptions = Record<string, Parameter>

export class Permission<
  const Resource extends string = any,
  const Options extends PermissionOptions = any,
> {
  constructor(
    readonly resource: Resource,
    readonly options: Options,
  ) {}
}
