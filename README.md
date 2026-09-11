# DTU Grocery Price Compare

### One search. Two stores. A reliable comparison — without pretending the data is more certain than it is.

DTU Grocery Price Compare is a full-stack grocery comparison application built for students at **Delhi Technological University (DTU), Shahbad Daulatpur, Delhi**.

The application compares grocery listings from **Blinkit and Zepto** while ensuring that the prices being compared actually belong to the DTU delivery context.

Instead of treating grocery comparison as simple string matching, the system combines:

* DTU-specific delivery verification
* Isolated provider adapters
* Provider-independent product models
* Deterministic normalization
* Conservative product matching
* One-to-one result assignment
* Provider-level failure handling
* Freshness-aware caching

> **One search. Two stores. A reliable comparison — without pretending the data is more certain than it is.**

---

## Overview

Grocery comparison becomes unreliable when the system does not know whether two prices actually represent the same product and delivery context.

For example, two listings may have:

* Different delivery locations
* Different quantities
* Different variants
* Different pack sizes
* Different product families
* Different availability states

DTU Grocery Price Compare addresses these problems before presenting a comparison.

The application first verifies the **DTU delivery context**, retrieves visible listings from each provider, converts them into a common representation, normalizes product attributes, filters incompatible candidates, and then performs deterministic matching.

---

## Architecture

```text
                         React + Vite
                              |
                              v
                       FastAPI Search API
                              |
                 +------------+------------+
                 |                         |
                 v                         v
          Blinkit Adapter            Zepto Adapter
                 |                         |
          Establish DTU             Establish DTU
             location                   location
                 |                         |
          Verify location             Verify location
                 |                         |
          Search products             Search products
                 |                         |
          Extract listings            Extract listings
                 |                         |
                 +------------+------------+
                              |
                              v
                     ProductListing Model
                              |
                              v
                       Normalization
                              |
                              v
                     Candidate Filtering
                              |
                              v
                    Deterministic Matching
                              |
                              v
                     Comparison Response
                              |
                              v
                         React UI
```

### Search Flow

1. The frontend sends a search request to the FastAPI backend.
2. Provider adapters run concurrently.
3. Each provider establishes the **DTU / Shahbad Daulatpur** delivery context.
4. The resolved location is verified.
5. Only after successful verification does the provider search for the requested product.
6. Visible product cards are extracted.
7. Provider-specific results are converted into a common `ProductListing`.
8. Product names, brands, quantities, variants and pack sizes are normalized.
9. Obviously incompatible products are rejected.
10. Remaining candidates are scored using deterministic matching rules.
11. Products are assigned one-to-one.
12. The API returns comparison results together with provider status and freshness information.

If DTU delivery cannot be verified, that provider is returned as **unavailable** and its prices are not used as valid comparison data.

---

# Key Architecture Decisions

## 1. Isolated Provider Adapters

Blinkit and Zepto are implemented behind separate provider adapters.

```text
Provider Interface
       |
       +---- Blinkit Adapter
       |
       +---- Zepto Adapter
```

Each adapter owns its provider-specific:

* Location flow
* Selectors
* Browser interaction
* Product extraction
* Failure handling

This keeps provider-specific website behaviour isolated from the core comparison system.

If one provider changes its DOM or selectors, the corresponding adapter can be updated without rewriting the normalization, matching, caching or frontend logic.

---

## 2. Location-First Verification

The application does not search first and assume that the returned prices are valid for DTU.

The provider boundary explicitly requires:

```text
establish_location("DTU")
        ↓
verify_resolved_location()
        ↓
search("Maggi")
        ↓
accept listings
```

A provider cannot contribute prices until its DTU delivery context has been successfully established and verified.

This prevents generic Delhi results from being incorrectly presented as DTU-specific prices.

If the location cannot be verified, the application **fails closed**.

---

## 3. Provider-Independent Product Model

Provider-specific listings are converted into a common `ProductListing` representation.

```text
ProductListing
├── name
├── brand
├── quantity
├── unit
├── variant
├── pack_count
├── price
├── provider
└── availability
```

The matching and comparison layers work with this common model rather than depending on provider-specific structures.

This creates a clean separation between:

**Data Acquisition → Normalization → Matching → Comparison**

---

# Product Normalization

Product titles cannot reliably be compared directly.

For example:

* `Maggi 2-Minute Masala Noodles 70g`
* `Maggi 2 Minutes Masala Noodles 70 g`

may represent the same product even though their titles are formatted differently.

The normalization layer extracts and standardizes important attributes.

### Quantity Normalization

```text
1 kg       → 1000 g
500 g      → 500 g
1 litre    → 1000 ml
500 ml     → 500 ml
6 pieces   → 6 pieces
```

### Brand Extraction

Known brands are extracted from structured provider data where available, with a conservative dictionary used as a fallback.

### Variant Extraction

Important variants are preserved instead of being discarded.

Examples include:

* Salted / Unsalted
* Regular / Zero
* Original
* Masala
* Atta
* Chocolate

### Pack Information

Pack counts and quantities are retained during matching.

For example:

```text
4 × 70 g
```

is not automatically treated as equivalent to:

```text
1 × 280 g
```

Even though the total weight is mathematically identical, the listings may represent different SKUs, packaging or offers.

---

# Deterministic Product Matching

The matching problem is more complicated than fuzzy string similarity.

Consider:

```text
Maggi 2-Minute Masala Noodles 70g
Maggi 2-Minute Masala Noodles 140g
Maggi Special Masala Noodles 70g
Maggi Atta Noodles 70g
```

These products share many tokens but should not automatically be considered equivalent.

The matcher therefore uses multiple stages.

## Candidate Blocking

Before fuzzy scoring, incompatible candidates are rejected.

Examples include:

* Known brand mismatch
* Materially different quantities
* Incompatible units
* Conflicting variants
* Likely multipack vs single-pack differences
* Different product families

This reduces false positives before similarity scoring.

## Deterministic Scoring

Remaining candidates are scored using:

| Signal                 | Weight |
| ---------------------- | -----: |
| Title token similarity |    45% |
| Brand                  |    25% |
| Quantity               |    20% |
| Variant consistency    |    10% |

### Confidence Thresholds

| Score         | Classification    |
| ------------- | ----------------- |
| `>= 0.85`     | High confidence   |
| `0.72 - 0.85` | Medium confidence |
| `< 0.72`      | Unpaired          |

Low-confidence candidates are left unpaired instead of being forced into an incorrect comparison.

---

# One-to-One Matching

The matcher prevents one provider SKU from being reused across multiple matches.

For example:

```text
Blinkit Product A ───── Zepto Product X
Blinkit Product B ───── Zepto Product Y
Blinkit Product C ───── No confident match
```

This avoids duplicated matches and produces cleaner comparison results.

---

# Large Result Handling

Provider results pass through a staged pipeline:

```text
Raw listings
      ↓
Deduplication
      ↓
Query relevance ranking
      ↓
Candidate blocking
      ↓
Compatibility filtering
      ↓
Similarity scoring
      ↓
One-to-one assignment
      ↓
Top K results
```

Listings are ranked using:

* Query-token coverage
* Product family relevance
* Brand relevance
* Provider result position

The API returns at most `TOP_K_RESULTS` results, with the default set to **15**.

The backend also exposes internal pipeline counts for debugging and development.

---

# Partial Provider Failure

One provider failing should not make the entire application unusable.

For example:

```text
Blinkit
✓ DTU verified
✓ Products retrieved

Zepto
✗ Provider unavailable
```

The application can still display verified Blinkit listings while clearly marking Zepto as unavailable.

However, the frontend does **not** claim that one store is cheaper unless both providers have:

1. Verified delivery contexts
2. Valid product matches
3. Comparable prices

This makes provider failure explicit instead of silently producing misleading comparisons.

---

# Hot Query Cache

Repeated searches are handled using an in-memory `HotQueryCache`.

### Configuration

| Property        |                     Default |
| --------------- | --------------------------: |
| Maximum entries |                          20 |
| TTL             |                 180 seconds |
| Cache key       | Normalized query + location |

Only successful comparison responses containing verified provider data are eligible for caching.

Each response exposes:

```text
cache.hit
cache.age_seconds
cache.fetched_at
```

The frontend uses this information to display a freshness label rather than claiming that cached prices are live at the exact current second.

### Eviction

When the cache reaches its maximum size, eviction favours entries with:

* Fewer hits
* Older access times

### Partial Results

A response containing verified listings from one provider and an unavailable second provider may still be cached briefly.

Completely failed requests and unverified provider listings are never cached as valid comparison data.

### Scaling

The cache is currently in-memory for simplicity.

At larger scale, the same cache abstraction can be backed by **Redis** without changing the search service contract.

---

# Demo Mode

The project includes deterministic mock providers for reliable demonstrations.

Set:

```env
USE_MOCK_PROVIDERS=true
```

Start the backend and use the frontend normally.

The UI clearly labels the results as:

> **Demo data**

Mock prices are never presented as live prices.

This makes the project reproducible even when external provider websites change their UI or restrict automated browsers.

---

# Live Provider Mode

Live mode is opt-in.

Install Chromium for Playwright:

```bash
playwright install chromium
```

Then run:

```bash
python -m app.scripts.check_live_providers "Maggi"
```

The live check:

1. Opens the normal desktop provider flow.
2. Establishes the DTU delivery location.
3. Verifies the resolved location.
4. Searches for the requested product.
5. Reads visible product listings.
6. Reports provider-specific results or failures.

Recommended local development settings:

```env
USE_MOCK_PROVIDERS=false
PROVIDER_HEADLESS=false
PROVIDER_USE_PERSISTENT_CONTEXT=true
PROVIDER_BROWSER_CHANNEL=chrome
PROVIDER_MANUAL_BOOTSTRAP=false
PROVIDER_DEBUG=true
```

The normal application flow is automatic.

The backend can reuse one persistent local browser profile per provider so the location flow does not need to be repeated unnecessarily during development.

Manual bootstrap is an optional developer recovery mechanism and is not required during normal application usage.

---

# Provider Behaviour and Failure Handling

Live provider checks may fail because of:

* DOM changes
* Selector changes
* Delivery-area restrictions
* Cookies or account state
* Security challenges
* CAPTCHA
* Anti-automation controls
* Temporary provider-side changes

The application treats these conditions as provider failures.

It does not attempt to bypass provider security controls.

If a provider cannot be verified reliably, it is reported as unavailable and uncertain data is not used in the comparison.

---

# Tech Stack

## Frontend

* React
* TypeScript
* Vite
* CSS
* Lucide Icons

## Backend

* Python 3.11+
* FastAPI
* Pydantic
* Playwright
* RapidFuzz

## Testing

* pytest
* pytest-asyncio

---

# Project Structure

```text
backend/
├── app/
│   ├── core/
│   │   └── config.py
│   ├── models/
│   ├── providers/
│   │   ├── blinkit/
│   │   └── zepto/
│   ├── services/
│   │   ├── normalization/
│   │   ├── matching/
│   │   └── orchestration/
│   └── main.py
│
└── tests/

frontend/
└── src/
    ├── api/
    ├── types/
    ├── App.tsx
    └── styles.css

DESIGN_NOTE.md
RECORDING_CHECKLIST.md
```

---

# Getting Started

## Backend

### Windows

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
```

### macOS / Linux

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create the environment file:

```bash
cp .env.example .env
```

For a deterministic demo:

```env
USE_MOCK_PROVIDERS=true
```

Start the API:

```bash
uvicorn app.main:app --reload --env-file .env
```

---

# Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally:

```text
http://localhost:5173
```

---

# API

## Health Check

```http
GET /api/health
```

## Search

```http
GET /api/search?q=maggi&location=DTU
```

The API response contains:

* Provider-independent comparison objects
* Provider status
* Matching confidence
* Cache information
* Partial provider failures

The `location` parameter is intentionally limited to the configured `DTU` context.

Generic Delhi or an unverified provider default location is not accepted as assignment data.

---

# Testing

Run:

```bash
cd backend
pytest
```

The test suite covers:

* Product normalization
* Weight conversion
* Volume conversion
* Piece/count handling
* Multipack handling
* Variant rejection
* Quantity mismatch detection
* Deterministic product matching
* Partial provider failure

Live provider websites are intentionally excluded from CI because external websites, DOM structures and delivery availability are outside the application's control.

---

# Opt-In Live Provider Check

After installing Chromium:

```bash
playwright install chromium
```

Run:

```bash
cd backend
python -m app.scripts.check_live_providers "Maggi"
```

Useful options include:

```text
--headed
--provider blinkit|zepto
--manual-bootstrap
```

A successful partial live response is valid.

For example:

```text
Blinkit → verified listings
Zepto   → unavailable
```

The application can still return the verified Blinkit results while keeping Zepto explicitly unavailable.

---

# Responsible Usage

The application is designed around explicit, user-triggered searches rather than continuous crawling.

It does not:

* Continuously crawl provider catalogues
* Run background scraping loops
* Fabricate unavailable prices
* Substitute generic Delhi data for unverified DTU data
* Bypass CAPTCHA
* Bypass anti-automation controls
* Treat failed provider responses as valid prices

Browser sessions can be reused during a local development process so the delivery-location flow does not need to be repeated unnecessarily for every search.

---

# Limitations

This application should be understood as a grocery comparison system, not a guaranteed real-time catalogue.

Results can be affected by:

* Provider website changes
* Selector changes
* Product availability
* Delivery-area eligibility
* Cookies or account state
* Price changes
* Product bundles
* Ambiguous product titles
* Provider security controls
* Incomplete provider catalogues

Prices may also change between the time the delivery context is verified and the time the result is displayed.

The application therefore exposes freshness information instead of implying that every result represents an exact real-time price.

---

# Design Principles

### Trust the data before comparing it

A provider price is useful only when the delivery context has been verified.

### Keep providers independent

Provider-specific website behaviour should remain inside the provider adapter.

### Normalize before matching

Products should be compared using structured attributes rather than raw titles.

### Reject uncertainty

A low-confidence match is better left unpaired than incorrectly compared.

### Fail partially, not silently

If one provider fails, its status should be visible while valid results from another provider can remain useful.

### Never bypass security controls

If a provider blocks automation, the application reports the provider as unavailable rather than attempting to evade the restriction.

---

# Why This Project Is Interesting

The interesting part of this project is not simply **retrieving products from two grocery websites**.

The harder engineering problem is determining:

> **When is it safe for the application to claim that two prices are actually comparable?**

That requires reasoning about several independent dimensions:

```text
                 Product Identity
                       |
                       v
Location ----> Data Validation <---- Provider Status
                       |
                       v
                Normalization
                       |
                       v
                  Matching
                       |
                       v
                Comparison
                       |
                       v
                  Freshness
```

The comparison is therefore treated as the final output of a validation pipeline rather than just a scraping result.

---

# Future Improvements

The current architecture can be extended with:

* Redis-backed distributed caching
* Persistent price history
* Price trend visualization
* Additional grocery providers
* Authorized provider APIs where available
* More sophisticated product-family extraction
* User-specific grocery lists
* Price-drop alerts
* Historical cheapest-store analysis
* Cloud deployment
* Isolated provider workers
* Provider health monitoring

The provider-adapter boundary allows new providers to be added without changing the core normalization, matching or comparison layers.

---

# Conclusion

DTU Grocery Price Compare is built around a simple principle:

> **A useful comparison is not just about finding two prices — it is about knowing whether those two prices are actually comparable.**

By combining **location-first verification, isolated provider adapters, deterministic normalization, conservative product matching, explicit failure states and freshness-aware caching**, the application prioritizes correctness and transparency over simply producing more results.

The goal is not to show the most prices possible.

The goal is to show **prices that the system has enough evidence to trust**.
