const APPS = [
  { id: 'todo', name: 'Todo', description: 'Capture and finish tasks', href: '/todo/', icon: '&#10003;', color: 'blue' },
  { id: 'flashcards', name: 'Flashcards', description: 'Create cards and study', href: '/flashcards/', icon: 'A', color: 'orange' },
  { id: 'geography', name: 'Geography', description: 'Learn where Israeli cities are', href: '/geography/', icon: '&#9906;', color: 'green' },
  { id: 'gym', name: 'Gym', description: 'Plan workouts and track weight', href: '/gym/', icon: '&#9878;', color: 'amber' },
]

const STORAGE_KEY = 'pi-home-app-preferences'
const STATUS_URL = '/server-status.json'
const appById = new Map(APPS.map((app) => [app.id, app]))

function loadPreferences() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  const savedOrder = Array.isArray(saved?.order) ? saved.order.filter((id) => appById.has(id)) : []
  const missing = APPS.map((app) => app.id).filter((id) => !savedOrder.includes(id))
  return {
    order: [...savedOrder, ...missing],
    hidden: new Set(Array.isArray(saved?.hidden) ? saved.hidden.filter((id) => appById.has(id)) : []),
  }
}

let preferences = loadPreferences()

function savePreferences() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    order: preferences.order,
    hidden: [...preferences.hidden],
  }))
}

function appLink(app) {
  const link = document.createElement('a')
  link.href = app.href
  link.className = 'app-link'
  link.innerHTML = `
    <span class="app-icon ${app.color}">${app.icon}</span>
    <span class="app-copy"><strong>${app.name}</strong><small>${app.description}</small></span>
    <b aria-hidden="true">&#8594;</b>
  `
  return link
}

function manageRow(app, visibleIndex, visibleCount) {
  const visible = !preferences.hidden.has(app.id)
  const row = document.createElement('div')
  row.className = 'manage-row'
  row.innerHTML = `
    <span class="app-icon small ${app.color}">${app.icon}</span>
    <strong>${app.name}</strong>
    <span class="row-actions">
      ${visible ? `<button type="button" data-action="up" aria-label="Move ${app.name} up" ${visibleIndex === 0 ? 'disabled' : ''}>&uarr;</button>
      <button type="button" data-action="down" aria-label="Move ${app.name} down" ${visibleIndex === visibleCount - 1 ? 'disabled' : ''}>&darr;</button>` : ''}
      <button type="button" data-action="toggle">${visible ? 'Hide' : 'Show'}</button>
    </span>
  `
  row.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => updateApp(app.id, button.dataset.action))
  })
  return row
}

function updateApp(id, action) {
  if (action === 'toggle') {
    if (preferences.hidden.has(id)) preferences.hidden.delete(id)
    else preferences.hidden.add(id)
  } else {
    const visible = preferences.order.filter((appId) => !preferences.hidden.has(appId))
    const currentIndex = visible.indexOf(id)
    const targetId = visible[currentIndex + (action === 'up' ? -1 : 1)]
    if (targetId) {
      const first = preferences.order.indexOf(id)
      const second = preferences.order.indexOf(targetId)
      ;[preferences.order[first], preferences.order[second]] = [preferences.order[second], preferences.order[first]]
    }
  }
  savePreferences()
  render()
}

function render() {
  const orderedApps = preferences.order.map((id) => appById.get(id))
  const visible = orderedApps.filter((app) => !preferences.hidden.has(app.id))
  const hidden = orderedApps.filter((app) => preferences.hidden.has(app.id))

  const menu = document.querySelector('#app-menu')
  menu.replaceChildren(...visible.map(appLink))
  document.querySelector('#empty-menu').hidden = visible.length > 0

  const visibleList = document.querySelector('#visible-apps')
  visibleList.replaceChildren(...visible.map((app, index) => manageRow(app, index, visible.length)))
  document.querySelector('#visible-empty').hidden = visible.length > 0

  const hiddenList = document.querySelector('#hidden-apps')
  hiddenList.replaceChildren(...hidden.map((app) => manageRow(app)))
  document.querySelector('#hidden-empty').hidden = hidden.length > 0
}

function showSettings(show) {
  document.querySelector('#home-screen').hidden = show
  document.querySelector('#settings-screen').hidden = !show
}

function relativeTime(value) {
  if (!value) return 'Not recorded'
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 45) return 'Just now'
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`
  return `${Math.round(seconds / 86400)}d ago`
}

function uptimeLabel(seconds) {
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return hours ? `${days}d ${hours}h` : `${days}d`
}

function fileSize(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

function metric(label, value) {
  const item = document.createElement('div')
  item.className = 'server-metric'
  const name = document.createElement('span')
  name.textContent = label
  const reading = document.createElement('strong')
  reading.textContent = value
  item.append(name, reading)
  return item
}

function statusDetail(label, value) {
  const detail = document.createElement('span')
  const name = document.createElement('b')
  name.textContent = label
  detail.append(name, document.createTextNode(value))
  return detail
}

function appStatusRow(app) {
  const row = document.createElement('article')
  row.className = 'app-status-row'

  const heading = document.createElement('div')
  heading.className = 'app-status-heading'
  const title = document.createElement('strong')
  title.textContent = app.name
  const state = document.createElement('span')
  state.className = `status-badge ${app.healthy ? 'healthy' : 'warning'}`
  state.textContent = app.healthy ? 'Healthy' : 'Check needed'
  heading.append(title, state)

  const details = document.createElement('div')
  details.className = 'app-status-copy'
  const deployment = app.deployedSha ? `${relativeTime(app.lastDeployment)} · ${app.deployedSha}` : 'Not recorded'
  details.append(statusDetail('Deployed', deployment))
  details.append(statusDetail('Attempt', relativeTime(app.lastDeployAttempt)))
  details.append(statusDetail('Checked', relativeTime(app.lastCheck)))
  if (app.database) {
    details.append(statusDetail('Data', `${relativeTime(app.database.updatedAt)} · ${fileSize(app.database.sizeBytes)}`))
  }
  if (app.backup) {
    details.append(statusDetail('Backup', `${relativeTime(app.backup.createdAt)} · ${app.backup.count} kept`))
  }

  row.append(heading, details)
  return row
}

function renderServerStatus(status) {
  const { server, apps } = status
  const dot = document.querySelector('#server-health-dot')
  dot.className = `health-dot ${server.healthy ? 'healthy' : 'warning'}`
  document.querySelector('#server-title').textContent = server.healthy ? 'Pi is running normally' : 'Pi needs a look'
  document.querySelector('#server-summary').textContent = `${apps.filter((app) => app.healthy).length} of ${apps.length} apps healthy · Snapshot ${relativeTime(status.generatedAt)}`

  const metrics = document.querySelector('#server-metrics')
  metrics.replaceChildren(
    metric('Temperature', server.temperatureC == null ? '—' : `${server.temperatureC}°`),
    metric('Memory', `${server.memoryUsedPercent}%`),
    metric('Storage', `${server.diskUsedPercent}%`),
    metric('Uptime', uptimeLabel(server.uptimeSeconds)),
  )
  metrics.hidden = false

  document.querySelector('#details-hint').textContent = `${apps.length} apps · Updated ${relativeTime(status.generatedAt)}`
  document.querySelector('#app-status-list').replaceChildren(...apps.map(appStatusRow))
}

function renderStatusError() {
  document.querySelector('#server-health-dot').className = 'health-dot unavailable'
  document.querySelector('#server-title').textContent = 'Status unavailable'
  document.querySelector('#server-summary').textContent = 'Server details appear here when Pi Home is running on the Raspberry Pi.'
  document.querySelector('#server-metrics').hidden = true
  document.querySelector('#details-hint').textContent = 'No snapshot available'
  document.querySelector('#app-status-list').replaceChildren()
}

async function loadServerStatus() {
  const button = document.querySelector('#refresh-status')
  button.disabled = true
  button.classList.add('loading')
  try {
    const response = await fetch(STATUS_URL, { cache: 'no-store' })
    if (!response.ok) throw new Error(`Status request failed: ${response.status}`)
    renderServerStatus(await response.json())
  } catch {
    renderStatusError()
  } finally {
    button.disabled = false
    button.classList.remove('loading')
  }
}

document.querySelector('#open-settings').addEventListener('click', () => showSettings(true))
document.querySelector('#close-settings').addEventListener('click', () => showSettings(false))
document.querySelector('#refresh-status').addEventListener('click', loadServerStatus)

render()
loadServerStatus()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js', { scope: '/' }))
}
