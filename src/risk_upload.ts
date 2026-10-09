import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { z } from "zod";
import { infrai } from "./infrai.js";

const BUCKET = "fintech-receipts";
const UploadRequest = z.object({ paymentId: z.string().min(1), imagePath: z.string().min(1), amountCents: z.number().int().nonnegative(), riskScore: z.number().min(0).max(1) });
export type UploadRequest = z.infer<typeof UploadRequest>;
export type UploadResult = { paymentId: string; objectKey: string; action: "review" | "settle"; auditEvent: string };

export function chooseAction(riskScore: number, amountCents: number): "review" | "settle" {
  return riskScore >= 0.7 || amountCents >= 100000 ? "review" : "settle";
}

export async function processUpload(input: unknown): Promise<UploadResult> {
  const request = UploadRequest.parse(input);
  await infrai.storage.bucket.create({ name: BUCKET });
  const original = await readFile(request.imagePath);
  const thumbnail = await sharp(original).resize({ width: 640, height: 640, fit: "inside" }).jpeg({ quality: 82 }).toBuffer();
  const objectKey = `payments/${request.paymentId}/receipt.jpg`;
  await infrai.storage.object.put(BUCKET, objectKey, { data_base64: thumbnail.toString("base64"), content_type: "image/jpeg", idempotency_key: `receipt-${request.paymentId}` });
  const head = await infrai.storage.object.head(BUCKET, objectKey);
  if (!head.found) throw new Error("stored receipt was not found");
  const action = chooseAction(request.riskScore, request.amountCents);
  return { paymentId: request.paymentId, objectKey, action, auditEvent: `payment.receipt.${action}` };
}

if (process.argv[1]?.endsWith("risk_upload.ts")) {
  const [paymentId, imagePath, amount, risk] = process.argv.slice(2);
  if (!paymentId || !imagePath || !amount || !risk) throw new Error("usage: npm start -- PAYMENT_ID IMAGE_PATH AMOUNT_CENTS RISK_SCORE");
  processUpload({ paymentId, imagePath, amountCents: Number(amount), riskScore: Number(risk) }).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
