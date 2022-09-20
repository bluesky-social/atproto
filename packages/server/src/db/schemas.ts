import { AdxSchemas } from '@adxp/schemas'
import { recordSchemas } from '../xrpc/schemas'

export const schemas = new AdxSchemas()

for (const schema of recordSchemas) {
  schemas.add(schema)
}

export default schemas
