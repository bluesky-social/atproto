import type { TemplateDelegate } from 'handlebars'

declare const template: TemplateDelegate<{
  token: string
  confirmationUrl: string
}>
export default template
