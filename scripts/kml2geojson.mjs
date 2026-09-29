import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DOMParser } from '@xmldom/xmldom'

const DATA_DIR = join(process.cwd(), 'data')
const kmlFile = readdirSync(DATA_DIR).find((f) => f.toLowerCase().endsWith('.kml'))

if (!kmlFile) {
  console.error('data/ საქაღალდეში .kml ფაილი ვერ მოიძებნა. ჩააგდე KML და ხელახლა გაუშვი.')
  process.exit(1)
}

const kmlPath = join(DATA_DIR, kmlFile)
const xml = readFileSync(kmlPath, 'utf-8')
const doc = new DOMParser().parseFromString(xml, 'text/xml')

function text(el, tag) {
  const node = el.getElementsByTagName(tag)[0]
  return node ? node.textContent.trim() : ''
}

function walk(el, folderPath, out) {
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType !== 1) continue
    if (child.tagName === 'Folder') {
      const name = text(child, 'name') || 'ზოგადი'
      walk(child, [...folderPath, name], out)
    } else if (child.tagName === 'Placemark') {
      const point = child.getElementsByTagName('Point')[0]
      if (!point) continue
      const coordsText = text(point, 'coordinates')
      const [lng, lat] = coordsText.split(',').map(Number)
      if (Number.isNaN(lng) || Number.isNaN(lat)) continue
      const description = text(child, 'description')
      const seasonMatch = description.match(/[სს]ეზონი\s*(\d+)\s*სერია\s*(\d+)/)
      out.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          id: out.length + 1,
          title_ka: text(child, 'name'),
          title_en: '',
          category: folderPath[folderPath.length - 1] || 'ზოგადი',
          season: seasonMatch ? Number(seasonMatch[1]) : null,
          episode: seasonMatch ? Number(seasonMatch[2]) : null,
          description_ka: description,
          description_en: '',
          image_url: ''
        }
      })
    } else {
      walk(child, folderPath, out)
    }
  }
}

const features = []
walk(doc.documentElement, [], features)

const geojson = { type: 'FeatureCollection', features }
const outPath = join(DATA_DIR, 'locations.geojson')
writeFileSync(outPath, JSON.stringify(geojson, null, 2), 'utf-8')

console.log(`გადაკონვერტირდა ${features.length} წერტილი → data/locations.geojson`)
