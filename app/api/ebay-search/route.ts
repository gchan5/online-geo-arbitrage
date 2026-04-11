import { findSoldListings } from '@/lib/ebay'

export async function POST(request: Request) {
  const { query } = await request.json() as { query: string }
  if (!query?.trim()) {
    return Response.json({ error: 'query is required' }, { status: 400 })
  }
  const listings = await findSoldListings(query.trim())
  return Response.json({ listings, total_results: listings.length })
}
