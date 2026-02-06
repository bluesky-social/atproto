import type { ServerResponse } from 'node:http'
import { html, js } from './html/index.js'
import { setCookie } from './http/request.js'
import { SecurityHeadersOptions } from './http/security-headers.js'
import { writeHtml } from './write-html.js'

export type WriteFormRedirectOptions = SecurityHeadersOptions

// We prevent the user from coming "back" to this page and resubmitting the form
// repeatedly by disabling the submit button after the first submission.
const SCRIPT = js`
const form = document.forms[0];

let canSubmit = true;

form.addEventListener('submit', (event) => {
  if (!canSubmit) {
    event.preventDefault();
  } else {
    canSubmit = false;
  }
});

setTimeout(() => {
  form.submit();
}, 1);
`

// @NOTE If translations and design are needed, consider replacing this with a
// web app page.

export function writeFormRedirect(
  res: ServerResponse,
  method: 'post' | 'get',
  uri: string,
  params: Iterable<[string, string]>,
  options?: WriteFormRedirectOptions,
): void {
  res.setHeader('Cache-Control', 'no-store')

  // Prevent the Chrome from caching this page
  // see: https://latesthackingnews.com/2023/12/12/google-updates-chrome-bfcache-for-faster-page-viewing/
  setCookie(res, 'bfCacheBypass', 'foo', { maxAge: 1, sameSite: 'lax' })

  return writeHtml(res, {
    ...options,
    htmlAttrs: { lang: 'en' },
    scripts: [SCRIPT],
    body: html`
      <form method="${method}" action="${uri}">
        ${Array.from(params, ([key, value]) => [
          html`<input type="hidden" name="${key}" value="${value}" />`,
        ])}
        <input type="submit" value="Continue" />
      </form>
    `,
  })
}
