declare module "*.hbs" {
  import { TemplateDelegate } from "handlebars";
  const template: TemplateDelegate<unknown>;
  export default template;
}
