import type { TemplateDelegate } from 'handlebars'

declare const template: TemplateDelegate<{
  token: string
  handle: string | null
  changePasswordUrl: string
}>
export default template
