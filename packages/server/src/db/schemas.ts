import { AdxSchemas } from '@adxp/schemas'
import { recordSchemas, viewSchemas } from '@adxp/microblog'

export const schemas = new AdxSchemas()

for (const schema of recordSchemas) {
  schemas.add(schema)
}
for (const schema of viewSchemas) {
  schemas.add(schema)
}

export default schemas
