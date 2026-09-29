import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DATA_PATH = join(process.cwd(), 'data', 'locations.geojson')
const IMAGES_DIR = join(process.cwd(), 'public', 'images')
mkdirSync(IMAGES_DIR, { recursive: true })

const geojson = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))

function extFromContentType(ct) {
  if (!ct) return 'jpg'
  if (ct.includes('png')) return 'png'
  if (ct.includes('webp')) return 'webp'
  return 'jpg'
}

let downloaded = 0
let failed = 0

for (const f of geojson.features) {
  const desc = f.properties.description_ka
  if (!desc) continue
  const matches = [...desc.matchAll(/<img src="([^"]+)"/g)]
  let updated = desc
  let n = 0
  for (const m of matches) {
    const originalUrl = m[1]
    const fetchUrl = originalUrl.replace(/([?&])fife=s\d+/, '$1fife=s500')
    n += 1
    const localName = `${f.properties.id}-${n}`
    try {
      const res = await fetch(fetchUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const ext = extFromContentType(res.headers.get('content-type'))
      const buf = Buffer.from(await res.arrayBuffer())
      writeFileSync(join(IMAGES_DIR, `${localName}.${ext}`), buf)
      updated = updated.replaceAll(originalUrl, `/hot-dog-map/images/${localName}.${ext}`)
      downloaded += 1
    } catch (e) {
      console.warn(`ვერ ჩამოიტვირთა (id ${f.properties.id}): ${originalUrl.slice(0, 60)}... — ${e.message}`)
      failed += 1
    }
  }
  f.properties.description_ka = updated
}

writeFileSync(DATA_PATH, JSON.stringify(geojson, null, 2), 'utf-8')
console.log(`ჩამოტვირთულია ${downloaded} სურათი, ვერ მოხერხდა ${failed}. geojson განახლდა.`)
