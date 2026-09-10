# Public railinfo CORS proxy

Authorized architecture exception: the provider does not enable browser CORS. This Worker accesses only the public railinfo station-search and departure/arrival endpoints. No secrets or National Rail authentication are required.

Deploy from the repository root after signing in to Cloudflare:

```sh
npx wrangler login
npx wrangler deploy --config worker/wrangler.toml
```

Set `API_BASE_URL` in `src/config.js` to the resulting HTTPS Worker origin (no trailing slash), bump the service-worker cache version, and verify live boards from the deployed frontend before publishing that config.

The Worker validates parameters, uses a fixed upstream, rejects redirects, caches boards for 20 seconds and searches for five minutes, and forwards 429 Retry-After responses. Browser origins are explicitly allowed. CORS is not access authentication; monitor public traffic and upstream quotas after deployment.

`npm test` exercises the proxy using simulated upstream responses. Actual Cloudflare deployment still requires account access.
