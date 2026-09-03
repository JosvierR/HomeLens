import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const artifactDirectory = join(root, 'artifacts', 'final-release')
const screenshotDirectory = join(artifactDirectory, 'screenshots')
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const profileDirectory = join(tmpdir(), `homelens-visual-qa-${Date.now()}`)
const baseUrl = (process.env.HOMELENS_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')

await mkdir(screenshotDirectory, { recursive: true })

const browser = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--disable-default-apps',
  '--disable-extensions',
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  '--remote-debugging-port=0',
  `--user-data-dir=${profileDirectory}`,
  'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] })

const browserWebSocketUrl = await new Promise((resolveUrl, reject) => {
  const timeout = setTimeout(() => reject(new Error('Chrome DevTools did not become ready.')), 15_000)
  let output = ''

  browser.stderr.setEncoding('utf8')
  browser.stderr.on('data', chunk => {
    output += chunk
    const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/)
    if (match?.[1]) {
      clearTimeout(timeout)
      resolveUrl(match[1])
    }
  })
  browser.once('exit', code => {
    clearTimeout(timeout)
    reject(new Error(`Chrome exited before DevTools was ready (${code ?? 'unknown'}).`))
  })
})

const debuggerAddress = new URL(browserWebSocketUrl)
const targetResponse = await fetch(`http://${debuggerAddress.host}/json/new?about:blank`, { method: 'PUT' })
if (!targetResponse.ok) throw new Error(`Unable to create a Chrome target: ${targetResponse.status}`)
const target = await targetResponse.json()

class DevToolsClient {
  constructor(url) {
    this.socket = new WebSocket(url)
    this.nextId = 1
    this.pending = new Map()
    this.listeners = new Map()
    this.ready = new Promise((resolveReady, reject) => {
      this.socket.addEventListener('open', resolveReady, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (message.id) {
        const request = this.pending.get(message.id)
        if (!request) return
        this.pending.delete(message.id)
        if (message.error) request.reject(new Error(message.error.message))
        else request.resolve(message.result)
        return
      }

      const eventListeners = this.listeners.get(message.method) ?? []
      eventListeners.forEach(listener => listener(message.params))
    })
  }

  async send(method, params = {}) {
    await this.ready
    const id = this.nextId++
    return new Promise((resolveRequest, reject) => {
      this.pending.set(id, { resolve: resolveRequest, reject })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  waitFor(method, timeoutMilliseconds = 10_000) {
    return new Promise((resolveEvent, reject) => {
      const timeout = setTimeout(() => {
        this.removeListener(method, listener)
        reject(new Error(`Timed out waiting for ${method}.`))
      }, timeoutMilliseconds)
      const listener = params => {
        clearTimeout(timeout)
        this.removeListener(method, listener)
        resolveEvent(params)
      }
      const eventListeners = this.listeners.get(method) ?? []
      eventListeners.push(listener)
      this.listeners.set(method, eventListeners)
    })
  }

  removeListener(method, listener) {
    const eventListeners = this.listeners.get(method) ?? []
    this.listeners.set(method, eventListeners.filter(item => item !== listener))
  }

  close() {
    this.socket.close()
  }
}

const client = new DevToolsClient(target.webSocketDebuggerUrl)
await client.send('Page.enable')
await client.send('Runtime.enable')

const runtimeIssues = []
client.listeners.set('Runtime.exceptionThrown', [params => {
  runtimeIssues.push({ type: 'exception', message: params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text ?? 'Unknown exception' })
}])
client.listeners.set('Runtime.consoleAPICalled', [params => {
  const message = params.args?.map(argument => argument.value ?? argument.description ?? '').join(' ') ?? ''
  if (params.type === 'error' || (params.type === 'warning' && /hydration/i.test(message))) {
    runtimeIssues.push({ type: params.type, message })
  }
}])

const urlFor = (path = '') => path ? `${baseUrl}/${path}` : `${baseUrl}/`
const analysisBlockPattern = `*://${new URL(baseUrl).host}/api/analysis*`
const pause = milliseconds => new Promise(resolvePause => setTimeout(resolvePause, milliseconds))
const evaluate = async expression => {
  const response = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
  return response.result.value
}

const setViewport = async (width, height) => {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    screenWidth: width,
    screenHeight: height,
    deviceScaleFactor: 1,
    mobile: width <= 430
  })
}

const navigate = async url => {
  const loaded = client.waitFor('Page.loadEventFired')
  await client.send('Page.navigate', { url })
  await loaded
  await pause(1_400)
  if (url.endsWith('/analysis')) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const ready = await evaluate(`Boolean(document.querySelector('.score-value, .state-panel--error'))`)
      if (ready) break
      await pause(150)
    }
  }
}

const inspectPage = () => evaluate(`(() => {
  const viewportWidth = window.innerWidth
  const overflowing = [...document.body.querySelectorAll('*')]
    .map(element => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ element, rect }) => {
      const style = getComputedStyle(element)
      return style.position !== 'fixed' && (rect.right > viewportWidth + 1 || rect.left < -1)
    })
    .slice(0, 8)
    .map(({ element, rect }) => ({
      tag: element.tagName.toLowerCase(),
      className: typeof element.className === 'string' ? element.className.slice(0, 100) : '',
      left: Math.round(rect.left),
      right: Math.round(rect.right)
    }))
  const unnamedButtons = [...document.querySelectorAll('button')]
    .filter(button => !(button.innerText || button.getAttribute('aria-label') || button.getAttribute('title')))
    .length
  const unlabeledInputs = [...document.querySelectorAll('input')]
    .filter(input => !input.labels?.length && !input.getAttribute('aria-label'))
    .length
  return {
    href: location.href,
    title: document.title,
    heading: document.querySelector('h1')?.textContent?.trim() ?? null,
    textLength: document.body.innerText.trim().length,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    documentWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    overflowing,
    errorOverlay: Boolean(document.querySelector('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay')),
    frameworkErrorPage: document.querySelector('h1')?.textContent?.trim() === '500' || document.body.innerText.includes('An error has occurred'),
    unnamedButtons,
    unlabeledInputs
  }
})()`)

const routes = [
  { name: 'home', path: '' },
  { name: 'scan', path: 'scan' },
  { name: 'analysis', path: 'analysis' }
]
const viewports = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 }
]

const results = []

try {
  for (const route of routes) {
    for (const viewport of viewports) {
      await setViewport(viewport.width, viewport.height)
      await navigate(urlFor(route.path))
      const inspection = await inspectPage()
      const screenshot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
      const fileName = `${route.name}-${viewport.width}x${viewport.height}.png`
      await writeFile(join(screenshotDirectory, fileName), Buffer.from(screenshot.data, 'base64'))
      results.push({ route: route.name, requestedViewport: viewport, ...inspection, screenshot: fileName })
      process.stdout.write(`captured ${fileName}\n`)
    }
  }

  for (const route of routes) {
    await setViewport(1440, 900)
    await navigate(urlFor(route.path))
    const metrics = await client.send('Page.getLayoutMetrics')
    const contentSize = metrics.cssContentSize
    const screenshot = await client.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: contentSize.width, height: contentSize.height, scale: 1 }
    })
    const fileName = `${route.name}-1440xfull.png`
    await writeFile(join(screenshotDirectory, fileName), Buffer.from(screenshot.data, 'base64'))
    process.stdout.write(`captured ${fileName}\n`)
  }

  await setViewport(1280, 800)
  await navigate(urlFor('scan'))
  await evaluate(`document.querySelector('.permission-gate .button')?.click()`)
  await pause(1_200)
  const livePreview = await evaluate(`(() => {
    const video = document.querySelector('.camera-video')
    return {
      exists: Boolean(video),
      width: video?.videoWidth ?? 0,
      height: video?.videoHeight ?? 0,
      opacity: video ? getComputedStyle(video).opacity : null,
      demoGeometryVisible: Boolean(document.querySelector('.capture-canvas .geometry'))
    }
  })()`)
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const stillCapturing = await evaluate(`Boolean(document.querySelector('.capture-workspace'))`)
    if (!stillCapturing) break
    await evaluate(`document.querySelector('.capture-step')?.click()`)
    await evaluate(`document.querySelector('.capture-button')?.click()`)
    await pause(800)
  }
  // Chrome's built-in fake webcam can be intentionally soft enough to trigger
  // the real blur guard. Finish the flow through the native-camera fallback with
  // deterministic, high-detail frames so QA keeps the production threshold intact.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const stillCapturing = await evaluate(`Boolean(document.querySelector('.capture-workspace'))`)
    if (!stillCapturing) break
    await evaluate(`(async () => {
      const input = document.querySelector('input[type="file"][capture="environment"]')
      if (!input) return false
      const canvas = document.createElement('canvas')
      canvas.width = 1280
      canvas.height = 720
      const context = canvas.getContext('2d')
      for (let y = 0; y < canvas.height; y += 24) {
        for (let x = 0; x < canvas.width; x += 24) {
          context.fillStyle = ((x / 24) + (y / 24)) % 2 ? '#e8ddd0' : '#405955'
          context.fillRect(x, y, 24, 24)
        }
      }
      context.strokeStyle = '#f5a65b'
      context.lineWidth = 8
      context.strokeRect(80 + ${attempt * 20}, 80, 1120, 560)
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92))
      const transfer = new DataTransfer()
      transfer.items.add(new File([blob], 'room-view-${attempt + 1}.jpg', { type: 'image/jpeg' }))
      Object.defineProperty(input, 'files', { configurable: true, value: transfer.files })
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`)
    await pause(900)
  }
  await evaluate(`(() => {
    const setValue = (selector, value) => {
      const input = document.querySelector(selector)
      if (!input) return
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    setValue('input[placeholder="12.5"]', '12.5')
    setValue('input[placeholder="16.0"]', '16')
    setValue('input[placeholder="9.0"]', '9')
  })()`)
  await pause(150)
  const scanFormState = await evaluate(`(() => ({
    hasWorkspace: Boolean(document.querySelector('.capture-workspace')),
    hasDetails: Boolean(document.querySelector('.details-workspace')),
    feedback: document.querySelector('.micro-feedback')?.textContent?.trim() ?? null,
    values: [...document.querySelectorAll('.measurement-form input')].map(input => input.value),
    assessment: document.querySelector('.evidence-heading h2')?.textContent?.trim() ?? null
  }))()`)
  const scanButtonFound = await evaluate(`Boolean(document.querySelector('.capture-step')) && !(document.querySelector('.capture-step')?.disabled)`)
  await evaluate(`(() => {
    const button = document.querySelector('.capture-step')
    button?.click()
    button?.click()
  })()`)
  await pause(100)
  const doubleCompletionGuard = await evaluate(`document.querySelector('.capture-step')?.disabled ?? true`)
  await pause(2_000)
  const scanTransition = await evaluate(`({
    href: location.href,
    path: location.pathname,
    hasAnalysisPage: Boolean(document.querySelector('.analysis-page'))
  })`)

  await navigate(urlFor('analysis?demo=1'))
  // A same-URL Page.navigate can preserve Nuxt's in-memory scan state. Reload so
  // the remaining checks intentionally exercise the standalone demo analysis.
  const demoReloaded = client.waitFor('Page.loadEventFired')
  await client.send('Page.reload', { ignoreCache: true })
  await demoReloaded
  await pause(1_400)
  await evaluate(`document.querySelector('.dimension--width')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
  await pause(100)
  const geometrySelection = await evaluate(`(() => ({
      widthRowSelected: document.querySelector('#measurement-width')?.classList.contains('measurement-row--selected') ?? false,
      heightRowSelected: document.querySelector('#measurement-height')?.classList.contains('measurement-row--selected') ?? false
    }))()`)
  const beforeVerification = await evaluate(`({
    stability: document.querySelector('.score-value')?.textContent?.trim() ?? null,
    rescueAction: document.querySelector('.verify-button')?.textContent?.trim() ?? null,
    source: document.querySelector('#measurement-height .source')?.textContent?.trim() ?? null,
    calibration: document.querySelector('.calibration-panel')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
    queue: document.querySelector('.queue-list')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null
  })`)
  await evaluate(`document.querySelector('.verify-button')?.click()`)
  await pause(250)
  const inlineEditorOpened = await evaluate(`Boolean(document.querySelector('#measurement-input-height'))`)
  await evaluate(`(() => {
    const input = document.querySelector('#measurement-input-height')
    if (!input) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, '9')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.closest('form')?.requestSubmit()
    return true
  })()`)
  await pause(1_700)
  const afterVerification = await evaluate(`({
    stability: document.querySelector('.score-value')?.textContent?.trim() ?? null,
    value: document.querySelector('#measurement-height .measurement-value')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
    source: document.querySelector('#measurement-height .source')?.textContent?.trim() ?? null,
    provenance: document.querySelector('#measurement-height .original-estimate')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
    evidenceFeedback: document.querySelector('.learning-feedback')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
    rescueStatus: document.querySelector('.stable-state')?.textContent?.trim() ?? null,
    queueContainsHeight: document.querySelector('.queue-list')?.textContent?.includes('Ceiling height') ?? false,
    calibration: document.querySelector('.calibration-panel')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null
  })`)

  await evaluate(`document.querySelector('a[href="/"]')?.click()`)
  await pause(600)
  await evaluate(`document.querySelector('a[href="/analysis?demo=1"]')?.click()`)
  await pause(1_400)
  const navigationPersistence = await evaluate(`document.querySelector('#measurement-height .source')?.textContent?.trim() === 'Verified'`)

  await evaluate(`[...document.querySelectorAll('.room-actions button, .room-actions .reset-link')].find(button => button.textContent?.includes('Reset'))?.click()`)
  await pause(900)
  const resetState = await evaluate(`({
    value: document.querySelector('#measurement-height .measurement-value')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    source: document.querySelector('#measurement-height .source')?.textContent?.trim() ?? null
  })`)
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const editorReady = await evaluate(`(() => {
      const button = document.querySelector('#measurement-height .edit-button, #measurement-height .row-verify')
      return Boolean(button && !button.disabled)
    })()`)
    if (editorReady) break
    await pause(150)
  }
  await evaluate(`document.querySelector('#measurement-height .edit-button, #measurement-height .row-verify')?.click()`)
  await pause(100)
  await evaluate(`(() => {
    const input = document.querySelector('#measurement-input-height')
    if (!input) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, '0')
    input?.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await pause(100)
  const invalidEdit = await evaluate(`({
      errorVisible: Boolean(document.querySelector('#measurement-height .input-error')),
      submitDisabled: document.querySelector('#measurement-height button[type="submit"]')?.disabled ?? false,
      acceptedValue: document.querySelector('#measurement-height .measurement-value')?.textContent?.trim() ?? null
  })`)

  await setViewport(430, 932)
  await navigate(urlFor())
  const homeLinks = await evaluate(`({
    identity: document.body.innerText.includes('HomeLens'),
    startHref: document.querySelector('a[href="/scan"]')?.href ?? null,
    sampleHref: document.querySelector('a[href="/analysis?demo=1"]')?.href ?? null
  })`)
  for (let i = 0; i < 4; i += 1) {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  }
  await pause(120)
  const keyboardA11y = await evaluate(`(() => {
    const active = document.activeElement
    const styles = active ? getComputedStyle(active) : null
    const unnamedControls = [...document.querySelectorAll('button, a')].filter(element => {
      const text = (element.innerText || '').replace(/\\s+/g, ' ').trim()
      return !(text || element.getAttribute('aria-label') || element.getAttribute('title'))
    }).length
    const unlabeledInputs = [...document.querySelectorAll('input')].filter(input => !input.labels?.length && !input.getAttribute('aria-label')).length
    const confidenceUsesText = [...document.querySelectorAll('.confidence')].every(element => /\\d+%/.test(element.textContent || ''))
    return {
      focusedTag: active?.tagName?.toLowerCase() ?? null,
      focusedName: (active?.innerText || active?.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
      outlineWidth: styles?.outlineWidth ?? null,
      outlineStyle: styles?.outlineStyle ?? null,
      unnamedControls,
      unlabeledInputs,
      confidenceUsesText,
      liveRegions: document.querySelectorAll('[aria-live], [role="status"]').length
    }
  })()`)
  await evaluate(`document.querySelector('.hero-actions a[href="/scan"]')?.click()`)
  await pause(600)
  const startNavigation = await evaluate(`location.pathname`)
  await evaluate(`history.back()`)
  await pause(600)
  const backNavigation = await evaluate(`location.pathname`)
  await evaluate(`history.forward()`)
  await pause(600)
  const forwardNavigation = await evaluate(`location.pathname`)
  await navigate(urlFor('analysis'))
  const reloadFinished = client.waitFor('Page.loadEventFired')
  await client.send('Page.reload', { ignoreCache: true })
  await reloadFinished
  await pause(1_600)
  const directAndRefresh = await evaluate(`({ path: location.pathname, heading: document.querySelector('h1')?.textContent?.trim() ?? null, hasDecision: Boolean(document.querySelector('.score-value')) })`)

  const normalRuntimeIssues = [...runtimeIssues]
  await client.send('Network.enable')
  await client.send('Network.setBlockedURLs', { urls: [analysisBlockPattern] })
  await navigate(urlFor('analysis'))
  const unavailableApiState = await evaluate(`({
    errorVisible: Boolean(document.querySelector('.recommendation .state-panel--error, .stability-panel .state-panel--error')),
    message: document.querySelector('.recommendation .state-panel--error, .stability-panel .state-panel--error')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
    roomStillInspectable: Boolean(document.querySelector('.geometry-area'))
  })`)
  const expectedFailureRuntimeIssues = runtimeIssues.slice(normalRuntimeIssues.length)
  await client.send('Network.setBlockedURLs', { urls: [] })

  const interactions = {
    navigation: { homeLinks, startNavigation, backNavigation, forwardNavigation, directAndRefresh },
    scanCompletion: { livePreview, formState: scanFormState, buttonFound: scanButtonFound, doubleCompletionGuard, ...scanTransition },
    geometrySelection,
    verification: { before: beforeVerification, inlineEditorOpened, after: afterVerification, navigationPersistence, resetState, invalidEdit },
    accessibility: keyboardA11y,
    failureHandling: { unavailableApiState, expectedFailureRuntimeIssues }
  }

  const overflowPages = results.filter(page => page.horizontalOverflow || page.overflowing.length || page.unnamedButtons || page.unlabeledInputs || page.errorOverlay || page.frameworkErrorPage)
  const checks = [
    ['home identity', Boolean(homeLinks.identity)],
    ['start scan navigation', startNavigation === '/scan'],
    ['browser back', backNavigation === '/'],
    ['browser forward', forwardNavigation === '/scan'],
    ['analysis refresh', directAndRefresh.path === '/analysis' && Boolean(directAndRefresh.hasDecision)],
    ['live camera preview', livePreview.exists && livePreview.width > 0 && livePreview.height > 0 && livePreview.opacity === '1' && !livePreview.demoGeometryVisible],
    ['scan completion guard', scanButtonFound && doubleCompletionGuard],
    ['scan reaches analysis', scanTransition.path === '/analysis' && scanTransition.hasAnalysisPage],
    ['geometry selection', geometrySelection.widthRowSelected && !geometrySelection.heightRowSelected],
    ['inline verification', inlineEditorOpened],
    ['verified provenance', Boolean(afterVerification.source?.includes('Verified') && afterVerification.provenance?.includes('9.1'))],
    ['verified item leaves queue', afterVerification.queueContainsHeight === false],
    ['reset restores demo', resetState.source === 'Estimated' && Boolean(resetState.value?.includes('9.1'))],
    ['invalid edit rejected', invalidEdit.errorVisible && invalidEdit.submitDisabled],
    ['api failure keeps geometry', unavailableApiState.errorVisible && unavailableApiState.roomStillInspectable],
    ['keyboard focus visible', Boolean(keyboardA11y.focusedTag) && keyboardA11y.outlineStyle !== 'none'],
    ['named controls', keyboardA11y.unnamedControls === 0 && keyboardA11y.unlabeledInputs === 0],
    ['confidence not color-only', keyboardA11y.confidenceUsesText],
    ['no page overflow', overflowPages.length === 0],
    ['no unexpected console errors', normalRuntimeIssues.length === 0]
  ]
  const report = {
    baseUrl,
    generatedAt: new Date().toISOString(),
    passed: checks.every(([, passed]) => passed) && overflowPages.length === 0,
    totals: { checks: checks.length, passed: checks.filter(([, passed]) => passed).length, failed: checks.filter(([, passed]) => !passed).length },
    checks: checks.map(([name, passed]) => ({ name, passed })),
    pages: results,
    interactions,
    normalRuntimeIssues,
    overflowPages
  }

  await writeFile(join(artifactDirectory, 'browser-results.json'), JSON.stringify(report, null, 2))
  process.stdout.write(`${JSON.stringify({ totals: report.totals, passed: report.passed, accessibility: keyboardA11y, overflowPages }, null, 2)}\n`)
  if (!report.passed) {
    process.stderr.write(`${JSON.stringify(report.checks.filter(item => !item.passed), null, 2)}\n`)
    process.exitCode = 1
  }
} finally {
  client.close()
  browser.kill()
}
