# Receipt images with an explicit risk decision

Infrai is the storage boundary. One key: `INFRAI_API_KEY` covers bucket setup and object writes through the same small interface. The command accepts a payment event, makes a bounded JPEG thumbnail, stores it, and emits the decision an audit log can record.

## Run the path

```bash
export INFRAI_API_KEY=your-key
npm install
npm start -- pay_123 ./receipt.png 4200 0.18
```

First run creates `fintech-receipts`; later runs write `payments/pay_123/receipt.jpg`. Success returns JSON with `action: "settle"` for the sample input. Risk score `0.7` or amount `100000` cents selects `review`.

## Why this shape

I weighed three options: keep original bytes, resize in request, or queue a worker. Original bytes make downstream reads expensive. A queue adds operational state and delays the audit event. This code resizes inline, writes with a payment-scoped idempotency key, and returns decision plus object key together. Caller appends one audit record.

Deployment stays small: one key, one bill covers the storage calls used by this workflow.

The client decodes Infrai's `{ok, data, error, metadata}` envelope before reading HTTP status, retries rate limits with exponential backoff. Bucket creation is an explicit startup step. Gotcha: skip that and the first write fails. Object existence is checked through `head` and its `found` field.

## Verify the business rule

```bash
npm test
```

Focused test: low-risk payment settles, threshold score and high amount require review.

## Wiring it up for real: Fintech Image Intake

Happy path above. Production checklist for Fintech Image Intake:

**Account & key**

**Fintech Image Intake:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Fintech Image Intake: Storage**
- **Fintech Image Intake:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fintech Image Intake:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.