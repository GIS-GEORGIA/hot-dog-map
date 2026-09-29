import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import ka from './i18n/ka.json'
import en from './i18n/en.json'

const dict = { ka, en }
const state = {
  lang: localStorage.getItem('lang') || 'ka',
  theme: localStorage.getItem('theme') || 'light',
  excludedCategories: new Set(),
  excludedSeasons: new Set(),
  data: null
}

function t(key) {
  return dict[state.lang][key] || key
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme)
  localStorage.setItem('theme', state.theme)
}

function applyLang() {
  document.documentElement.setAttribute('lang', state.lang)
  localStorage.setItem('lang', state.lang)
  document.getElementById('lang-switch').value = state.lang
}

const map = L.map('map', { zoomControl: true }).setView([42.0, 43.5], 6)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map)

const clusterGroup = L.markerClusterGroup()
map.addLayer(clusterGroup)

function seasonLabel(season) {
  if (season == null) return state.lang === 'ka' ? 'უცნობი' : 'Unknown'
  return state.lang === 'ka' ? `სეზონი ${season}` : `Season ${season}`
}

function popupHtml(props) {
  const title = state.lang === 'ka' ? props.title_ka : props.title_en || props.title_ka
  const desc = state.lang === 'ka' ? props.description_ka : props.description_en
  const navLink =
    props.lat && props.lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${props.lat},${props.lng}`
      : null
  const badge = props.season != null ? `<span class="popup-badge">${seasonLabel(props.season)}${props.episode != null ? ` · ${state.lang === 'ka' ? 'სერია' : 'Ep.'} ${props.episode}` : ''}</span>` : ''
  return `
    <div>
      ${props.image_url ? `<img src="${props.image_url}" style="width:100%;border-radius:6px;margin-bottom:0.4rem" />` : ''}
      <p class="popup-title">${title || ''}</p>
      ${badge}
      ${desc ? `<div class="popup-desc">${desc}</div>` : ''}
      ${navLink ? `<a class="popup-nav" href="${navLink}" target="_blank" rel="noopener">${t('navigate')}</a>` : ''}
    </div>
  `
}

function passesFilters(f) {
  const { category, season } = f.properties
  const seasonKey = season == null ? 'other' : String(season)
  return !state.excludedCategories.has(category) && !state.excludedSeasons.has(seasonKey)
}

function renderMarkers() {
  clusterGroup.clearLayers()
  if (!state.data) return
  const features = state.data.features.filter(passesFilters)
  for (const f of features) {
    const [lng, lat] = f.geometry.coordinates
    const marker = L.marker([lat, lng])
    marker.bindPopup(popupHtml({ ...f.properties, lat, lng }))
    clusterGroup.addLayer(marker)
  }
  document.getElementById('stats').innerHTML = `<div class="total">${t('total_points')}: ${features.length} / ${state.data.features.length}</div>`
}

function buildFilterGroup(container, title, items, excludedSet) {
  const group = document.createElement('div')
  group.className = 'filter-group'
  group.innerHTML = `<strong>${title}</strong>`
  for (const { key, label, count } of items) {
    const row = document.createElement('label')
    row.innerHTML = `<input type="checkbox" ${excludedSet.has(key) ? '' : 'checked'} /> ${label} <span class="count">(${count})</span>`
    row.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) excludedSet.delete(key)
      else excludedSet.add(key)
      renderMarkers()
    })
    group.appendChild(row)
  }
  container.appendChild(group)
}

function renderFilters() {
  if (!state.data) return
  const el = document.getElementById('filters')
  el.innerHTML = ''

  const catCounts = new Map()
  const seasonCounts = new Map()
  for (const f of state.data.features) {
    const cat = f.properties.category
    catCounts.set(cat, (catCounts.get(cat) || 0) + 1)
    const seasonKey = f.properties.season == null ? 'other' : String(f.properties.season)
    seasonCounts.set(seasonKey, (seasonCounts.get(seasonKey) || 0) + 1)
  }

  const categoryItems = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, label: key, count }))
  buildFilterGroup(el, t('filters'), categoryItems, state.excludedCategories)

  const seasonItems = [...seasonCounts.entries()]
    .sort((a, b) => (a[0] === 'other' ? 1 : b[0] === 'other' ? -1 : a[0] - b[0]))
    .map(([key, count]) => ({
      key,
      label: key === 'other' ? seasonLabel(null) : seasonLabel(Number(key)),
      count
    }))
  buildFilterGroup(el, state.lang === 'ka' ? 'სეზონი' : 'Season', seasonItems, state.excludedSeasons)
}

async function loadData() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/locations.geojson`)
    if (!res.ok) throw new Error('no data yet')
    state.data = await res.json()
    renderFilters()
    renderMarkers()
    if (state.data.features.length) {
      const bounds = L.geoJSON(state.data).getBounds()
      map.fitBounds(bounds, { padding: [20, 20] })
    }
  } catch (e) {
    console.warn('locations.geojson not found yet — run `npm run kml2geojson` after dropping a KML in data/', e)
  }
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  state.theme = state.theme === 'light' ? 'dark' : 'light'
  applyTheme()
})

document.getElementById('lang-switch').addEventListener('change', (e) => {
  state.lang = e.target.value
  applyLang()
  renderFilters()
  renderMarkers()
})

document.getElementById('sidebar-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed')
})

applyTheme()
applyLang()
loadData()
