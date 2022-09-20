import { MethodSchema } from '@adxp/xrpc'
import { AdxSchemaDefinition } from '@adxp/schemas'

export interface GeneratedFile {
  path: string
  content: string
}

export interface GeneratedAPI {
  files: GeneratedFile[]
}

export type Schema = MethodSchema | AdxSchemaDefinition
