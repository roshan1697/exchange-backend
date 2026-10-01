# exchange-backend

A crypto/stock exchange simulator built from scratch: an in-memory matching
engine, a REST API, a WebSocket feed, a Postgres/TimescaleDB-backed history
service, and a simple market maker — talking to each other entirely over
Redis.

## Features

- **Order matching** with price-time priority, partial fills, and self-trade
  prevention
- **Multiple markets**, created on demand (not locked to a single trading
  pair)
- **Balances** with available/locked accounting, so funds are reserved the
  moment an order is placed and released/settled correctly on fills or
  cancellation
- **Live order book & trade feed** over WebSocket (subscribe per market)
- **Kline/candlestick, ticker, and recent-trades** history backed by
  TimescaleDB
- **A market maker** that continuously quotes both sides of the book, so
  there's always some liquidity to test against
- Crash-safe-ish: the engine snapshots its state periodically and on
  shutdown, and reloads it on restart if asked to

## Architecture

```
                     ┌─────────┐
   HTTP requests ──▶ │   api   │
                     └────┬────┘
                          │ LPUSH "messages" / await reply on a
                          │ per-request Redis pub/sub channel
                          ▼
                     ┌─────────┐   publishes trade/depth updates
                     │ engine  │──────────────┬───────────────┐
                     └────┬────┘              ▼               ▼
                          │ LPUSH         ┌─────────┐    ┌──────────┐
                          │ "db_processor"│   ws    │    │ (clients │
                          ▼               └─────────┘    │ via REST)│
                     ┌─────────┐                          └──────────┘
                     │   db    │──▶ Postgres / TimescaleDB
                     └─────────┘

                     ┌─────────┐
                     │   mm    │──▶ places/cancels orders via the api,
                     └─────────┘    like any other client
```

| Service  | What it does | Talks to |
|----------|---------------|----------|
| `engine` | In-memory order book + matching logic, balances, snapshotting | Redis |
| `api`    | Public REST API (Express) | Redis, Postgres |
| `db`     | Persists trade ticks for history/kline queries | Redis, Postgres |
| `ws`     | WebSocket server for live depth/trade subscriptions | Redis |
| `mm`     | Market maker — a scripted client of the REST API | `api` |

## Tech stack

- [Bun](https://bun.sh) + TypeScript for every service
- Express for the REST API
- `redis` (node-redis v6/v7) for the queue + pub/sub backbone
- `pg` + TimescaleDB for trade history and kline aggregation
- `ws` for the WebSocket server
- `axios` for the market maker's HTTP calls
- `bun test` for unit (engine) and integration (api) tests

## Getting started

### 1. Start infrastructure

```bash
docker compose up -d   # Redis + TimescaleDB
```

### 2. Configure each service

Each service reads config from environment variables — copy its
`.env.example` to `.env` and adjust if you changed any defaults (Bun loads
`.env` automatically, no extra setup needed):

```bash
for svc in api db engine mm ws; do cp $svc/.env.example $svc/.env; done
```

### 3. Create the database schema

```bash
cd db && bun install
bun run seed-db.ts   # creates tables + kline materialized views (one-time)
```

### 4. Run everything

Each service is independent — run them in separate terminals (or a process
manager of your choice):

```bash
cd engine && bun install && bun run index.ts   # matching engine
cd api    && bun install && bun run index.ts   # REST API on :3000
cd db     && bun run index.ts                  # trade -> Postgres writer
cd db     && bun run cron.ts                   # refreshes kline views every 10s
cd ws     && bun install && bun run index.ts   # WebSocket server on :3001
cd mm     && bun install && bun run index.ts   # optional: market maker
```

## REST API

All endpoints are under `/api/v1`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/order` | Place an order. Body: `{ market, price, quantity, side, userId }` |
| `DELETE` | `/order` | Cancel an order. Body: `{ orderId, market, userId }` — `userId` must match the order's owner |
| `GET` | `/order/open?userId=&market=` | List a user's open orders in a market |
| `GET` | `/depth?market=` | Current bids/asks for a market |
| `GET` | `/balance?userId=` | A user's balances by asset |
| `POST` | `/onramp/inr` | Credit a user's INR balance. Body: `{ userId, amount, txnId? }` |
| `GET` | `/kline?market=&interval=&startTime=&endTime=` | Candlesticks. `interval` is `1m`, `1h`, or `1w`; times are unix seconds |
| `GET` | `/ticker?market=` | Last price, 24h high/low/volume |
| `GET` | `/trades?market=&limit=` | Recent trades (default 50, max 500) |
| `GET` | `/health` | Liveness check |

Orders are quoted in INR today (e.g. `market: "TATA_INR"`); a market is
created the first time an order is placed for a new base asset, so you're
not limited to whatever markets already exist.

## WebSocket API

Connect to the `ws` service (default `ws://localhost:3001`) and send:

```json
{ "method": "SUBSCRIBE", "params": ["depth@TATA_INR", "trade@TATA_INR"] }
```

```json
{ "method": "UNSUBSCRIBE", "params": ["depth@TATA_INR"] }
```

Channels follow the pattern `depth@<MARKET>` and `trade@<MARKET>`; you'll
receive the engine's published update messages for whatever you're
subscribed to.

## Testing

```bash
cd engine && bun test   # unit tests for the order book / matching engine
cd api    && bun test   # integration tests — needs Redis + a running engine
```

## Project structure

```
api/      REST API — routes, Redis request/response client, types
db/       Trade-history writer, kline materialized-view refresher, schema seed
engine/   Order book, matching logic, balances, snapshotting
mm/       Market maker
ws/       WebSocket server, subscription/user management
```

## Known limitations / good next steps

- **No authentication.** Every endpoint trusts whatever `userId` the caller
  sends. Cancel-order checks that the caller's `userId` matches the order's
  owner, but nothing stops a caller from claiming to be any `userId` in the
  first place.
- **No persisted order history / audit trail.** `db` only stores trade
  ticks (for kline/ticker/trades); there's no `orders` table, so open-order
  history doesn't survive an engine restart beyond whatever's in
  `snapshot.json`.
- **Single process, in-memory order book.** The engine can't be
  horizontally scaled or restarted without downtime; a crash between
  snapshots loses any orders placed since the last 3-second snapshot
  interval.
- **No rate limiting.**
- **`kline`/`ticker`/`trades` aren't market-aware yet.** They currently
  read a single `tata_prices` table; multi-market history would need a
  market-aware schema (the `currency_code` column is there but unused for
  filtering).
- **TimescaleDB is required for `seed-db.ts`** (`create_hypertable`) —
  plain Postgres will fail on that call. `docker-compose.yml` uses the
  TimescaleDB image for this reason.
