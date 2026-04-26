import { findSoldListings } from '@/lib/ebay'

export async function POST(request: Request) {
  const { query } = await request.json() as { query: string }
  if (!query?.trim()) {
    return Response.json({ error: 'query is required' }, { status: 400 })
  }
  const normalizedQuery = query.trim()
  console.info('[api/ebay-search] received query', { query: normalizedQuery })
  const listings = await findSoldListings(normalizedQuery)
  console.info('[api/ebay-search] completed search', {
    query: normalizedQuery,
    total_results: listings.length,
  })
  return Response.json({ listings, total_results: listings.length })
}
