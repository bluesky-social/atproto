# Quick Reference: Playwright Test Workflow

## Phase 0: Setup

```sh
claude plugin install playwright@claude-plugins-official
pnpx @playwright/mcp install-browser chrome-for-testing
```

`zed/settings.json`:
```json
{
  // ...
  "context_servers": {
    // ...
    "mcp-server-playwright": {
      "settings": {
        "browser": "chromium",
        "headless": false,
        "vision": false,
      },
    },
  },
  "agent": {
    // ...
    "tool_permissions": {
      "tools": {
        "mcp:mcp-server-playwright:browser_console_messages": {
          "default": "allow",
        },
        "mcp:mcp-server-playwright:browser_close": { "default": "allow" },
        "mcp:mcp-server-playwright:browser_evaluate": { "default": "allow" },
        "mcp:mcp-server-playwright:browser_navigate": { "default": "allow" },
        "mcp:mcp-server-playwright:browser_press_key": { "default": "allow" },
        "mcp:mcp-server-playwright:browser_click": { "default": "allow" },
        "mcp:mcp-server-playwright:browser_type": { "default": "allow" },
        "mcp:mcp-server-playwright:browser_wait_for": { "default": "allow" },
        "mcp:mcp-server-playwright:browser_snapshot": { "default": "allow" },
        "mcp:mcp-server-playwright:browser_take_screenshot": {
          "default": "allow",
        },
      },
    },
  }
}
```

## Phase 1: Discovery (Playwright MCP)

### Start a dev server (in the background)

```sh
cd packages/dev-env
pnpm dev
```

PDS should be running at http://localhost:2583

### Navigation & Inspection
```javascript
browser_navigate('http://localhost:PORT/path')
browser_snapshot({ boxes: true })
```

### Test Interactions
```javascript
browser_click({ element: 'button "Text"', target: 'ref' })
browser_type({ element: 'textbox', text: 'value' })
browser_wait_for({ time: 2 })
browser_snapshot() // Check error messages
browser_console_messages({ level: 'error' }) // Check server errors
browser_take_screenshot({ filename: 'evidence.png' })
```

## Phase 2: Write Test (Jest/Puppeteer)

### Test Template
```typescript
it('describes the edge case', async () => {
  await using page = await PageHelper.from(browser, { languages })

  // Navigate
  await page.goto(new URL('/path', network.pds.url))
  await page.assertTitle('Expected Title')

  // Navigate to feature
  await page.clickOnText('Menu', 'a')
  await page.clickOnText('Submenu')

  // Perform action
  await page.typeInInput('fieldName', 'edge-case-value')
  await page.clickOnText('Submit')

  // Wait and assert
  await page.waitForNetworkIdle()
  await page.ensureTextVisibility('Error message')

  // Verify no change
  await page.clickOnText('Back')
  await page.ensureTextVisibility('original-value', 'span')
})
```

### Key PageHelper Methods
- `page.goto(url)` - Navigate
- `page.assertTitle(text)` - Assert page title
- `page.clickOnText(text, tag?)` - Click button/link
- `page.clickOnAriaLabel(label, tag?)` - Click by aria-label
- `page.typeInInput(name, text)` - Type in input[name="..."]
- `page.typeIn(selector, text)` - Type in arbitrary selector
- `page.ensureTextVisibility(text, tag?)` - Assert text is visible
- `page.waitForNetworkIdle()` - Wait for async operations

## Run Tests
```sh
cd packages/pds
pnpm test -- tests/your-test.test.ts
```
