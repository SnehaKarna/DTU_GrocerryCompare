import type { HotQuery, SearchResponse, ServiceHealth } from '../types/grocery'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

export async function searchGroceries(query: string): Promise<SearchResponse> {
  const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}&location=DTU`, { cache: 'no-store' })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail ?? 'The grocery service is unavailable.')
  }
  return response.json() as Promise<SearchResponse>
}

export async function getHotQueries(): Promise<HotQuery[]> {
  const response = await fetch(`${API_BASE}/api/search/hot`, { cache: 'no-store' })
  if (!response.ok) return []
  const body = await response.json() as { queries: HotQuery[] }
  return body.queries
}

export async function getHealth(): Promise<ServiceHealth> {
  const response = await fetch(`${API_BASE}/api/health`)
  if (!response.ok) throw new Error('Service health is unavailable')
  return response.json() as Promise<ServiceHealth>
}
