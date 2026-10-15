# Khoj — search made safe for kids

Zero dependencies. Needs Node 20.6+.

## Run
```
cp .env.example .env   # then paste a search key into .env
npm start              # http://localhost:3000
```

## Search keys (pick one)
**Google (SafeSearch always on):** Google closed the Custom Search JSON API to new
customers and shuts it down on Jan 1, 2027. If you already have a working key + engine ID,
set `GOOGLE_API_KEY` and `GOOGLE_CX` (100 free searches/day).
**Brave (works for new projects):** get a key at api-dashboard.search.brave.com and set
`BRAVE_API_KEY`. It includes about $5 of free credit each month (~1,000 searches) and asks
for a card as an anti-fraud check. Strict safe search is always on.

Khoj uses Google if both Google values are set, otherwise Brave.

## Free hosting
`npx vercel` (Hobby plan). Add the same keys under Project → Settings → Environment Variables.

## Kid-safety layers
1. Provider safe search forced to the strictest level
2. Blocked-word check on every search
3. Blocked-word + blocked-site filter on every result
4. Strict content-security policy, no cookies, no accounts, no search logging
5. Daily search cap (`DAILY_LIMIT`) and per-visitor rate limit so the free quota can't run out
Note: your search provider still receives the search text.
