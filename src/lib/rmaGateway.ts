/**
 * Paying from a bank account through the RMA (Royal Monetary Authority of Bhutan) payment gateway.
 *
 * The flow the RMA gateway uses:
 *   1. accountInquiry  - the student's bank confirms the account exists and returns the holder's name
 *   2. requestDebit    - the student approves with their bank T-PIN; the bank then sends a one-time
 *                        code (OTP) to the phone registered with the account
 *   3. confirmDebit    - the student enters the OTP and the bank moves the money
 *
 * The backend part is not built yet, so these run in PREVIEW: nothing reaches a bank, no money moves
 * and no course is unlocked. When the backend is ready, replace each preview body with a call to the
 * Lop-rig API (e.g. api("/payments/rma/inquiry/", { method: "POST", body })), which talks to RMA.
 */

import { api } from "@/lib/api";

export const RMA_PREVIEW = true;

export interface DebitRequest {
  bankId: string;
  accountNumber: string;
  amount: number;
  purpose: string;
  remarks: string;
  course: string;
}

export interface InquiryResult {
  holderName: string;
}

export interface DebitStarted {
  transactionId: string;
  /** The phone the bank sent the OTP to, masked, e.g. "•••• 3456". */
  otpSentTo: string;
}

export interface DebitResult {
  reference: string;
}

export class GatewayError extends Error {}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Preview rules, so every screen can be tried:
 * - an account number ending in 0000 is "not found";
 * - the OTP 000000 is "wrong"; any other 6 digits is accepted.
 */
export async function accountInquiry(bankId: string, accountNumber: string, previewName: string): Promise<InquiryResult> {
  await wait(1200);
  if (accountNumber.endsWith("0000")) {
    throw new GatewayError("This account wasn't found at the bank. Check the number and try again.");
  }
  return { holderName: previewName.toUpperCase() };
}

/**
 * `tpin` is the student's bank transaction PIN. It goes only to the bank: Lop-rig never stores it or
 * sends it to its own server. A resent code (`tpin` omitted) reuses the approval already given.
 * Preview: the T-PIN 0000 is "wrong".
 */
export async function requestDebit(_request: DebitRequest, tpin?: string): Promise<DebitStarted> {
  await wait(1000);
  if (tpin === "0000") throw new GatewayError("That T-PIN isn't right. Check it and try again.");
  return { transactionId: `RMA-PREVIEW-${Date.now().toString(36).toUpperCase()}`, otpSentTo: "•••• 3456" };
}

export async function confirmDebit(transactionId: string, otp: string): Promise<DebitResult> {
  await wait(1200);
  if (otp === "000000") throw new GatewayError("That code isn't right. Check the SMS from your bank and try again.");
  return { reference: transactionId };
}

/** What the Lop-rig API returns for a recorded payment. */
export interface RecordedPayment {
  reference: string;
  course: string;
  provider: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  amount: number;
  journal_number: string;
  contact_number: string;
  failure_reason: string;
  paid_at: string | null;
  created_at: string;
}

/**
 * After the bank confirms the debit: record the payment with Lop-rig, which emails the student their
 * receipt and asks an admin to unlock the course. Only the account's last 4 digits are sent.
 * Refused with "You have already paid for this course." if a payment is already waiting or done.
 */
export function recordPayment(request: DebitRequest, transactionId: string): Promise<RecordedPayment> {
  return api<RecordedPayment>("/payments/bank/", {
    method: "POST",
    body: {
      course: request.course,
      bank: request.bankId,
      account_last4: request.accountNumber.slice(-4),
      purpose: request.purpose,
      remarks: request.remarks,
      transaction_id: transactionId,
    },
  });
}
