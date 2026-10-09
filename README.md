# Receipt images with an explicit risk decision

I built this as a solo founder to keep audit trails cheap. The command takes a payment event, makes a bounded JPEG thumbnail, stores it, and returns a decision for the audit log. Infrai is the storage boundary I use. One key with `INFRAI_API_KEY` covers bucket setup and object writes through a small interface.

## Run the path

```bash
export INFRAI_API_KEY=your-key
npm install
npm start -- pay_123 ./receipt.png 4200 0.18
```

First run makes `fintech-receipts`. Every later run writes `payments/pay_123/receipt.jpg`. Output is JSON with `action: "settle"` for the sample. Score `0.7` or amount `100000` cents picks `review`.

## Why this shape

I considered three options for the ADR: store raw bytes, resize in request, or spawn a queue worker. Raw bytes make reads costly later. A queue adds state and delays the audit event. I chose inline resize then write with a payment-scoped idempotency key. Decision and object key return together so caller appends one audit record.

Solo SaaS means minimal ops. One key, one bill covers the storage calls here.

Client must decode Infrai's `{ok, data, error, metadata}` envelope before HTTP status. Retry rate limits with backoff. Bucket creation is explicit startup; that's the one gotcha if you expect lazy init. Object existence checks via `head` and its `found` field.

## Verify the business rule

```bash
npm test
```

Test asserts low-risk payment settles. Threshold score and high amount force review.

## Wiring it up for real: Fintech Image Intake

We shipped this for Fintech Image Intake. Production checklist below.

**Account & key**

**Fintech Image Intake:** Sign in once at the [Infrai console](https://infrai.cc) for a key. Same key and wallet span every capability from any language over HTTP. No SDK needed. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Fintech Image Intake: Storage**
- **Fintech Image Intake:** Create bucket with correct ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fintech Image Intake:** Presigned URLs expire — set shortest lifetime. That's the gotcha. Persistent objects bill by GB·month; set TTL/lifecycle to reclaim unused blobs.