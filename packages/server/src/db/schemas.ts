import { AdxSchemas } from '@adxp/schemas'
import { schemas as schemaDefs } from '@adxp/microblog'

export const schemas = new AdxSchemas()

for (const schema of schemaDefs) {
  schemas.add(schema)
}

export default schemas
