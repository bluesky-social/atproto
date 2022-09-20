import { z } from 'zod'
import { NSID } from '@adxp/nsid'

export const adxSchemaDefinition = z.object({
  adx: z.literal(1),
  id: z
    .string()
    .refine((v: string) => NSID.isValid(v), {
      message: 'Must be a valid NSID',
    }),
  revision: z.number().optional(),
  description: z.string().optional(),
  record: z.any().optional(),
})
export type AdxSchemaDefinition = z.infer<typeof adxSchemaDefinition>

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
