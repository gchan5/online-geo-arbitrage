// Usage: node scripts/debug-mercari.mjs <mercari-url>
import * as cheerio from 'cheerio'

const url = process.argv[2]
if (!url) {
  console.error('Usage: node scripts/debug-mercari.mjs <mercari-url>')
  process.exit(1)
}

// Extract item ID from URL
const itemId = url.match(/\/item\/(m\w+)/)?.[1]
console.log('Item ID:', itemId)

const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8',
}

// --- Try Mercari's internal API ---
console.log('\n=== Mercari API: api.mercari.jp/items/get ===')
try {
  const apiRes = await fetch(`https://api.mercari.jp/items/get?id=${itemId}`, { headers })
  console.log('Status:', apiRes.status)
  const text = await apiRes.text()
  console.log('Response (first 500 chars):', text.slice(0, 500))
} catch (e) {
  console.log('Error:', e.message)
}

// --- Try v2 API ---
console.log('\n=== Mercari API: api.mercari.jp/v2/items ===')
try {
  const apiRes = await fetch(`https://api.mercari.jp/v2/items/${itemId}`, {
    headers: { ...headers, 'X-Platform': 'web', 'X-Mercari-Version': 'latest' },
  })
  console.log('Status:', apiRes.status)
  const text = await apiRes.text()
  console.log('Response (first 500 chars):', text.slice(0, 500))
} catch (e) {
  console.log('Error:', e.message)
}

// --- Confirmed working: meta tags ---
console.log('\n=== Meta tags (confirmed) ===')
const pageRes = await fetch(url, { headers })
const html = await pageRes.text()
const $ = cheerio.load(html)

const getMeta = (prop) =>
  $(`meta[property="${prop}"]`).attr('content') ||
  $(`meta[name="${prop}"]`).attr('content') || ''

console.log('title:', getMeta('og:title').replace(/ by メルカリ$/, ''))
console.log('price_jpy:', getMeta('product:price:amount'))
console.log('image_1:', getMeta('og:image'))

// Probe for extra images by pattern (Mercari uses sequential _1, _2, _3...)
if (itemId) {
  console.log('\n=== Probing for additional images ===')
  const baseImg = getMeta('og:image').replace(/_1\.jpg.*/, '')
  for (let i = 2; i <= 6; i++) {
    const imgUrl = `${baseImg}_${i}.jpg`
    try {
      const r = await fetch(imgUrl, { method: 'HEAD', headers })
      console.log(`  _${i}.jpg →`, r.status, r.status === 200 ? '✓' : '✗')
      if (r.status !== 200) break
    } catch {
      break
    }
  }
}
