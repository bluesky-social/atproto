import assert from 'node:assert'
import { type Browser, Handler, type Page, Target, TargetType } from 'puppeteer'

export class PageHelper implements AsyncDisposable {
  constructor(protected readonly page: Page) {}

  async goto(url: string | URL) {
    await this.page.goto(url.toString())
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

  async navigationAction(run: () => Promise<unknown>): Promise<void> {
    const promise = this.page.waitForNavigation({
      waitUntil: 'networkidle0',
      timeout: 5_000,
    })
    await run()
    await promise
  }

  async navigationButtonClick(text: string) {
    return this.navigationAction(() => this.clickOnText(text))
  }

  async checkTitle(expected: string) {
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
    await elementHandle.type(text)
    return elementHandle
  }

  async typeInInput(name: string, text: string) {
    return this.typeIn(`input[name=${JSON.stringify(name)}]`, text)
  }

  async ensureTextVisibility(text: string, tag = 'p') {
    await this.page.waitForSelector(
      `${tag}::-p-text(${JSON.stringify(text)})`,
      {
        visible: true,
        timeout: 5_000,
      },
    )
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
    browser: Browser,
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
