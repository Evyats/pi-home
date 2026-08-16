const APPS = [
  { id: 'todo', name: 'Todo', description: 'Capture and finish tasks', href: '/todo/', icon: '&#10003;', color: 'blue' },
  { id: 'flashcards', name: 'Flashcards', description: 'Create cards and study', href: '/flashcards/', icon: 'A', color: 'orange' },
  { id: 'geography', name: 'Geography', description: 'Learn where Israeli cities are', href: '/geography/', icon: '&#9906;', color: 'green' },
]

const STORAGE_KEY = 'pi-home-app-preferences'
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

document.querySelector('#open-settings').addEventListener('click', () => showSettings(true))
document.querySelector('#close-settings').addEventListener('click', () => showSettings(false))

render()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js', { scope: '/' }))
}
