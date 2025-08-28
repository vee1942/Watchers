Watchers Eye

Full-stack wallet viewer + gas-fee balance (SQLite).

Local Dev
```
npm install
ADMIN_KEY=1738 PORT=3001 npm start
# open http://localhost:3001
```

Deploy on Render
- Root Directory: /
- Build Command: npm install
- Start Command: npm start
- Environment: add ADMIN_KEY=1738 (PORT provided by Render)

BscScan API Key (client-side)
You can store a key once in the browser. Pages will append it to API requests.
- Open any page and set:
```
localStorage.setItem('we_bscscan_key', 'YOUR_KEY');
```

Pages
- resive.html: authenticate and set wallet + uid
- home.html: shows BNB and USD (BscScan + CoinGecko)
- database.html: shows DB gas-fee balance
- admin.html: apply manual deposits (works cross-origin using API Base)

API
- POST /api/register { uid, email, name }
- GET /api/profile/:uid
- POST /api/deposits/manual (x-admin-key: 1738) { uid, amountUsd, note }
## Watchers Eye backend

Run a small Express + SQLite API to support per-uid balances and manual deposits.

### Install

```bash
cd /media/valentino/me/it
npm install
```

### Start

```bash
ADMIN_KEY="your-admin-key" npm start
```

The server runs at http://localhost:3001.

### Endpoints

- POST /api/register { uid, email, name } → upsert user and ensure balance row exists
- GET /api/profile/:uid → { uid, email, name, balance_usd }
- POST /api/deposits/manual { uid, amountUsd, note? } with header `x-admin-key: <ADMIN_KEY>` → increments balance

### Frontend wiring

- resive.html: authenticates, saves uid/name/email, calls POST /api/register
- home.html: fetches GET /api/profile/:uid to display USD balance
- database.html: shows balance and includes an Admin Manual Deposit form


