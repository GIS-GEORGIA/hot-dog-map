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
  activeCategories: new Set(),
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

function popupHtml(props) {
  const title = state.lang === 'ka' ? props.title_ka : props.title_en || props.title_ka
  const desc = state.lang === 'ka' ? props.description_ka : props.description_en
  const navLink =
    props.lat && props.lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${props.lat},${props.lng}`
      : null
  return `
    <div>
      ${props.image_url ? `<img src="${props.image_url}" style="width:100%;border-radius:6px;margin-bottom:0.4rem" />` : ''}
      <p class="popup-title">${title || ''}</p>
      ${desc ? `<p class="popup-desc">${desc}</p>` : ''}
      ${navLink ? `<a class="popup-nav" href="${navLink}" target="_blank" rel="noopener">${t('navigate')}</a>` : ''}
    </div>
  `
}

function renderMarkers() {
  clusterGroup.clearLayers()
  if (!state.data) return
  const features = state.data.features.filter(
    (f) => state.activeCategories.size === 0 || state.activeCategories.has(f.properties.category)
  )
  for (const f of features) {
    const [lng, lat] = f.geometry.coordinates
    const marker = L.marker([lat, lng])
    marker.bindPopup(popupHtml({ ...f.properties, lat, lng }))
    clusterGroup.addLayer(marker)
  }
  document.getElementById('stats').innerHTML = `<div class="total">${t('total_points')}: ${features.length}</div>`
}

function renderFilters() {
  if (!state.data) return
  const categories = [...new Set(state.data.features.map((f) => f.properties.category).filter(Boolean))].sort()
  const el = document.getElementById('filters')
  el.innerHTML = `<strong>${t('filters')}</strong>`
  for (const cat of categories) {
    const id = `cat-${cat}`
    const label = document.createElement('label')
    label.innerHTML = `<input type="checkbox" id="${id}" checked /> ${cat}`
    label.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) state.activeCategories.delete(cat)
      else state.activeCategories.add(cat)
      renderMarkers()
    })
    el.appendChild(label)
  }
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
