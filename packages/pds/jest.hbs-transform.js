/**
 * Jest transform for .hbs (Handlebars template) files.
 * The compiled templates live in dist/mailer/templates/.
 * This transform returns a stub function so tests can load the module graph
 * without needing the full esbuild+handlebars pipeline.
 */
module.exports = {
  process(_src, filename) {
    // Return a minimal template function (empty string) — sufficient for
    // tests that don't actually send emails.
    return {
      code: 'module.exports = function template() { return ""; }; module.exports.default = module.exports;',
    }
  },
}
