import assert from 'node:assert'
import {
  type Browser,
  type BrowserContext,
  type Handler,
  type Page,
  type Target,
  TargetType,
} from 'puppeteer'

export class PageHelper implements AsyncDisposable {
  constructor(protected readonly page: Page) {}

  async goto(url: string | URL) {
    await this.page.goto(url.toString())
  }

  async reload() {
    await this.page.reload()
  }

  isClosed() {
    return this.page.isClosed()
  }

  async title() {
    await this.waitForNetworkIdle()
    return this.page.title()
  }

  async waitForNetworkIdle() {
    await this.page.waitForNetworkIdle()
  }

  async waitForPopup(run: () => Promise<unknown>): Promise<PageHelper> {
    const browser = this.page.browser()
    const popupPromise = new Promise<Page | null>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout)
        browser.off('targetcreated', targetcreated)
      }

      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('Timeout waiting for popup'))
      }, 5_000)

      const targetcreated: Handler<Target> = async (target) => {
        switch (target.type()) {
          case TargetType.BACKGROUND_PAGE:
          case TargetType.PAGE: {
            cleanup()
            resolve(target.page())
          }
        }
      }

      browser.once('targetcreated', targetcreated)
    })

    await run()
    const popup = await popupPromise
    assert(popup, 'Popup page not found')

    return new PageHelper(popup)
  }

  async navigationAction(run: () => unknown | Promise<unknown>): Promise<void> {
    const promise = this.page.waitForNavigation({ timeout: 10_000 })
    await run()
    await promise
  }

  async navigationClick(text: string, tag = 'button') {
    return this.navigationAction(() => this.clickOnText(text, tag))
  }

  async assertTitle(expected: string) {
    await expect(this.title()).resolves.toBe(expected)
  }

  async clickOn(selector: string) {
    const elementHandle = await this.getVisibleElement(selector)
    await elementHandle.click()
    return elementHandle
  }

  async clickOnText(text: string, tag = 'button') {
    return this.clickOn(`${tag}::-p-text(${JSON.stringify(text)})`)
  }

  async clickOnAriaLabel(label: string, tag = 'button') {
    return this.clickOn(`${tag}[aria-label=${JSON.stringify(label)}]`)
  }

  async typeIn(selector: string, text: string) {
    const elementHandle = await this.getVisibleElement(selector)
    elementHandle.focus()
    await elementHandle.click({ count: 3 }) // Select all existing text
    await elementHandle.press('Backspace') // Clear the input
    await elementHandle.type(text, { delay: 20 }) // Give the web app time to react to each keystroke
    return elementHandle
  }

  async typeInInput(name: string, text: string) {
    return this.typeIn(`input[name=${JSON.stringify(name)}]`, text)
  }

  /**
   * Sets an input's value the way a password manager fills it: without
   * focusing (or blurring) it, followed by a bubbling `input` event.
   */
  async fillInput(name: string, value: string) {
    const elementHandle = await this.getVisibleElement(
      `input[name=${JSON.stringify(name)}]`,
    )
    await elementHandle.evaluate((input, value) => {
      ;(input as HTMLInputElement).value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }, value)
    return elementHandle
  }

  async getInputState(name: string) {
    const elementHandle = await this.getVisibleElement(
      `input[name=${JSON.stringify(name)}]`,
    )
    return elementHandle.evaluate((input) => {
      const { value, validity } = input as HTMLInputElement
      return {
        value,
        valid: validity.valid,
        patternMismatch: validity.patternMismatch,
      }
    })
  }

  /**
   * Runs `run` and returns the first JSON response whose URL matches `match`.
   */
  async captureJsonResponse(
    match: (url: URL) => boolean,
    run: () => unknown | Promise<unknown>,
  ) {
    const promise = this.page.waitForResponse(
      (res) => match(new URL(res.url())),
      {
        timeout: 10_000,
      },
    )
    try {
      await run()
    } catch (err) {
      promise.catch(() => {}) // Avoid an unhandled rejection on timeout
      throw err
    }
    const response = await promise
    return {
      status: response.status(),
      body: (await response.json()) as unknown,
    }
  }

  async waitForHidden(selector: string, timeout = 5_000) {
    await this.page.waitForSelector(selector, { hidden: true, timeout })
  }

  async ensureTextVisibility(text: string, tag = 'p', timeout = 5_000) {
    await this.page.waitForSelector(
      `${tag}::-p-text(${JSON.stringify(text)})`,
      {
        visible: true,
        timeout,
      },
    )
  }

  async ensureNotification(text: string) {
    return this.ensureTextVisibility(text, 'div')
  }

  protected async getVisibleElement(selector: string) {
    const elementHandle = await this.page.waitForSelector(selector, {
      visible: true,
      timeout: 5_000,
    })

    assert(elementHandle, `Element not found: ${selector}`)

    return elementHandle
  }

  async [Symbol.asyncDispose]() {
    return this.page.close()
  }

  static async from(
    browser: Browser | BrowserContext,
    options?: { languages?: readonly string[] },
  ) {
    const page = await browser.newPage()

    if (options?.languages?.length) {
      // Spoof navigator language settings
      await page.evaluateOnNewDocument(`
        Object.defineProperty(navigator, 'languages', {
          get: () => ${JSON.stringify(options.languages)},
        })
        Object.defineProperty(navigator, 'language', {
          get: () => ${JSON.stringify(options.languages[0])},
        })
      `)
    }

    return new PageHelper(page)
  }
}
