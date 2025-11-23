# marqr

## Web

Simple QR code generator UI for creating quick, styled QR codes, powered by [qr-code-styling](https://github.com/kozakdenys/qr-code-styling)

Live service: https://marqr.net

### Running locally

1. [Install pnpm](https://pnpm.io/installation)
2. Run web (static)
```bash
cd web
pnpm i
pnpm run dev
```

## Edge

Cloudflare Worker: static web deploy + bonus worker for redirecting QR codes to their destinations.

### Deploying

Optional; you can deploy the web app anywhere.

1. Configure a cloudflare worker https://developers.cloudflare.com/workers/get-started/deploy
2. Copy `wrangler.example.jsonc` to `wrangler.jsonc` and fill in your D1 database ID
3. Deploy
```bash
cd edge
pnpm i
pnpm run deploy
```

To create the database and schema for local development:
npx wrangler d1 create redirects
npx wrangler d1 execute redirects --local --file=src/schema.sql