import { z } from 'zod'

const adxSchemaDefinitionType = z.enum([
  'adxs-collection',
  'adxs-record',
  'adxs-view',
])
export type AdxSchemaDefinitionType = z.infer<typeof adxSchemaDefinitionType>

const adxSchemaDefinitionLocalizedStrings = z.record(
  z.object({
    nameSingular: z.string(),
    namePlural: z.string(),
  }),
)
export type AdxSchemaDefinitionLocalizedStrings = z.infer<
  typeof adxSchemaDefinitionLocalizedStrings
>

export const adxSchemaDefinition = z.object({
  $type: adxSchemaDefinitionType,
  author: z.string(),
  name: z.string(),
  revision: z.number().optional(),
  locale: adxSchemaDefinitionLocalizedStrings.optional(),
  reads: z.string().array().optional(),
  schema: z.any().optional(),
  parameters: z.any().optional(),
  response: z.any().optional(),
})
export type AdxSchemaDefinition = z.infer<typeof adxSchemaDefinition>

export const adxFallbackStrings = z.record(z.string())
export type AdxFallbackStrings = z.infer<typeof adxFallbackStrings>

export class AdxSchemaDefinitionMalformedError extends Error {
  constructor(
    message: string,
    public schemaDef: any,
    public issues?: z.ZodIssue[],
  ) {
    super(message)
    this.schemaDef = schemaDef
    this.issues = issues
  }
}

export class SchemaNotFoundError extends Error {}
export class WrongSchemaTypeError extends Error {}
