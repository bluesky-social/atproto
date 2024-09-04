// Postgresql will throw a specific error code with the constraint when trying to create a template with duplicate name
// see https://www.postgresql.org/docs/current/errcodes-appendix.html
export const isDuplicateTemplateNameError = (err: any) => {
  return (
    err?.['code'] === '23505' &&
    err?.['constraint'] === 'communication_template_unique_name'
  )
}
