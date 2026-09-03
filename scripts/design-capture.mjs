import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const phase = process.argv[2] === 'after' ? 'after' : 'before'
const outputDirectory = join(root, 'artifacts', 'human-design-pass', phase)
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const profileDirectory = join(tmpdir(), `homelens-design-${Date.now()}`)
const baseUrl = (process.env.HOMELENS_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')

await mkdir(outputDirectory, { recursive: true })

const browser = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--disable-default-apps',
  '--disable-extensions',
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

const pause = milliseconds => new Promise(resolvePause => setTimeout(resolvePause, milliseconds))
const evaluate = async expression => {
  const response = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
  return response.result.value
}

const setViewport = async (width, height) => {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width, height, screenWidth: width, screenHeight: height, deviceScaleFactor: 1, mobile: width <= 430
  })
}

const navigate = async path => {
  const loaded = client.waitFor('Page.loadEventFired')
  await client.send('Page.navigate', { url: path ? `${baseUrl}/${path}` : `${baseUrl}/` })
  await loaded
  await pause(1_500)
  if (path === 'analysis') {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const ready = await evaluate(`Boolean(document.querySelector('[data-stability-value], .state-panel--error'))`)
      if (ready) break
      await pause(150)
    }
    await pause(400)
  }
}

const captureFull = async name => {
  const metrics = await client.send('Page.getLayoutMetrics')
  const size = metrics.cssContentSize
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png', fromSurface: true, captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: size.width, height: Math.min(size.height, 12_000), scale: 1 }
  })
  await writeFile(join(outputDirectory, `${name}.png`), Buffer.from(screenshot.data, 'base64'))
  process.stdout.write(`captured ${phase}/${name}.png (${Math.round(size.height)}px tall)\n`)
  return Math.round(size.height)
}

const heights = {}

try {
  for (const [name, path, width, height] of [
    ['home-desktop', '', 1440, 900],
    ['scan-desktop', 'scan', 1440, 900],
    ['analysis-desktop', 'analysis', 1440, 900],
    ['home-tablet', '', 768, 1024],
    ['analysis-tablet', 'analysis', 768, 1024],
    ['home-mobile', '', 375, 812],
    ['scan-mobile', 'scan', 375, 812],
    ['analysis-mobile', 'analysis', 375, 812]
  ]) {
    await setViewport(width, height)
    await navigate(path)
    heights[name] = await captureFull(name)
  }

  await setViewport(1440, 900)
  await navigate('analysis')
  const inventory = await evaluate(`(() => {
    const all = [...document.querySelectorAll('main *')]
    const surfaces = all.filter(element => {
      const style = getComputedStyle(element)
      const hasBorder = parseFloat(style.borderTopWidth) > 0 || parseFloat(style.borderLeftWidth) > 0
      const hasBackground = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundImage === 'none'
      const hasShadow = style.boxShadow !== 'none'
      const radius = parseFloat(style.borderTopLeftRadius) || 0
      return (hasBorder || hasBackground || hasShadow) && radius >= 6 && element.getBoundingClientRect().width > 80
    })
    const gradients = all.filter(element => /gradient/.test(getComputedStyle(element).backgroundImage)).length
    const pills = all.filter(element => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return parseFloat(style.borderTopLeftRadius) >= 999 && rect.width > 0 && rect.height > 0 && rect.height < 44
    }).length
    const radii = {}
    all.forEach(element => {
      const radius = getComputedStyle(element).borderTopLeftRadius
      const rect = element.getBoundingClientRect()
      if (radius !== '0px' && rect.width > 40) radii[radius] = (radii[radius] ?? 0) + 1
    })
    const uppercase = all.filter(element => getComputedStyle(element).textTransform === 'uppercase' && element.textContent.trim().length).length
    return { surfaces: surfaces.length, gradients, pills, uppercase, radii, shadows: all.filter(e => getComputedStyle(e).boxShadow !== 'none').length }
  })()`)

  await writeFile(join(outputDirectory, 'inventory.json'), JSON.stringify({ phase, baseUrl, heights, analysisInventory: inventory }, null, 2))
  process.stdout.write(`${JSON.stringify({ heights, inventory }, null, 2)}\n`)
} finally {
  client.close()
  browser.kill()
}
