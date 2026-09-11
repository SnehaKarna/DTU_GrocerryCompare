import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, MapPin, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { getHealth, getHotQueries, searchGroceries } from './api/groceryApi'
import type { ComparisonResult, HotQuery, Listing, ProviderName, SearchResponse } from './types/grocery'

const suggestions = ['Maggi', 'Milk', 'Bread', 'Eggs', 'Butter']
const money = (value?: number) => value === undefined ? '—' : `₹${value.toFixed(value % 1 ? 2 : 0)}`
const label = (provider: ProviderName) => provider === 'blinkit' ? 'Blinkit' : 'Zepto'

function StorePrice({ listing, provider, unavailable }: { listing?: Listing; provider: ProviderName; unavailable: boolean }) {
  return <div className="store-price"><div className="store-name"><span className={`dot ${provider}`} />{label(provider)}</div>{listing ? <><strong>{money(listing.price)}</strong><span className={listing.available ? 'stock' : 'muted'}>{listing.available ? 'In stock' : 'Unavailable'}</span>{listing.unit_price !== undefined && <small>{money(listing.unit_price)} / {listing.unit_price_basis}</small>}</> : <strong className="muted">{unavailable ? 'Offline' : 'No match'}</strong>}</div>
}

function ProductRow({ result, status }: { result: ComparisonResult; status: SearchResponse['provider_status'] }) {
  const score = result.match_score === undefined ? null : Math.round(result.match_score * 100)
  const winner = result.cheaper_provider === 'same_price' ? 'Same price' : result.cheaper_provider ? `${label(result.cheaper_provider)} is cheaper` : 'No price winner'
  return <article className="product-row"><div className="product"><span>{result.brand ?? 'Grocery item'}</span><h3>{result.canonical_name}</h3><p>{result.quantity.value ? `${result.quantity.value} ${result.quantity.unit}` : 'Quantity not confirmed'}</p></div><div className="prices"><StorePrice listing={result.blinkit} provider="blinkit" unavailable={status.blinkit === 'unavailable'} /><StorePrice listing={result.zepto} provider="zepto" unavailable={status.zepto === 'unavailable'} /></div><div className="match-note"><Check size={14} />{winner}<small>{result.match_confidence === 'unmatched' ? 'Unmatched' : `${score}% match`}</small></div><details><summary>Match details</summary><p>{result.match_reasons.length ? result.match_reasons.join(' · ') : 'The stores did not provide enough detail.'}</p></details></article>
}

export default function App() {
  const [query, setQuery] = useState('')
  const [data, setData] = useState<SearchResponse | null>(null)
  const [popular, setPopular] = useState<HotQuery[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [highOnly, setHighOnly] = useState(false)
  const [stockOnly, setStockOnly] = useState(false)
  const [online, setOnline] = useState(true)
  useEffect(() => { getHotQueries().then(setPopular).catch(() => setPopular([])); getHealth().then(value => setOnline(value.status === 'ok')).catch(() => setOnline(false)) }, [])
  async function runSearch(value: string) { const next = value.trim(); if (next.length < 2 || loading) return; setQuery(next); setLoading(true); setError(''); try { setData(await searchGroceries(next)); setPopular(await getHotQueries()) } catch (caught) { setData(null); setError(caught instanceof Error ? caught.message : 'The grocery service is unavailable.') } finally { setLoading(false) } }
  const results = useMemo(() => (data?.results ?? []).filter(result => (!highOnly || result.match_confidence === 'high') && (!stockOnly || [result.blinkit, result.zepto].some(item => item?.available))), [data, highOnly, stockOnly])
  const quick = popular.length ? popular.map(item => item.query) : suggestions
  return <main><header><a className="brand" href="/"><span className="brand-mark">G</span><span><strong>Grocery Compare</strong><small>DTU delivery prices</small></span></a><div className="header-info"><span className={online ? 'service online' : 'service'}><i />{online ? 'Online' : 'Offline'}</span><span className="campus"><MapPin size={14} /> DTU campus</span></div></header><section className="search-area"><div className="heading"><p>Grocery price checker</p><h1>Compare before you buy.</h1><span><ShieldCheck size={14} /> Only verified DTU delivery listings are shown.</span></div><form onSubmit={event => { event.preventDefault(); void runSearch(query) }}><div className="input-wrap"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search groceries" /><button disabled={query.trim().length < 2 || loading}>{loading ? 'Searching' : 'Search'}</button></div><div className="suggestions"><span>Suggestions</span>{quick.slice(0, 5).map(item => <button type="button" key={item} onClick={() => void runSearch(item)}>{item}</button>)}</div></form></section>{data?.demo_mode && <div className="notice demo">Demo data is enabled. Prices are examples.</div>}{error && <div className="notice error"><AlertCircle size={15} />{error}<button onClick={() => setError('')}>Dismiss</button></div>}<section className="results">{data ? <><div className="results-top"><div><p>Search results</p><h2>{data.query}</h2><span>{results.length} of {data.results.length} products · {data.cache.hit ? 'Cached result' : 'Recently checked'}</span></div><button className="refresh" onClick={() => void runSearch(data.query)} disabled={loading}><RefreshCw size={14} /> Refresh</button></div><div className="controls"><div><span className="store-key"><i className="provider-dot blinkit" /> Blinkit: {data.provider_status.blinkit}</span><span className="store-key"><i className="provider-dot zepto" /> Zepto: {data.provider_status.zepto}</span></div><div><label><input type="checkbox" checked={highOnly} onChange={event => setHighOnly(event.target.checked)} /> High confidence</label><label><input type="checkbox" checked={stockOnly} onChange={event => setStockOnly(event.target.checked)} /> In stock</label></div></div>{results.length ? results.map(result => <ProductRow key={result.match_id} result={result} status={data.provider_status} />) : <div className="empty"><h3>No results found</h3><p>Try another grocery name.</p></div>}</> : <div className="empty first"><h2>Search for a grocery item</h2><p>You will see Blinkit and Zepto prices side by side.</p></div>}</section><footer>Prices and availability change. Confirm details with the provider before ordering.</footer></main>
}
