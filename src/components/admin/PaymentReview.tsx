"use client";

import { useEffect, useRef, useState } from "react";
import { X, CheckCircle, XCircle, ImageBroken } from "@phosphor-icons/react";
import { useToast } from "@/context/ToastContext";
import { api, apiBlob, errorMessage } from "@/lib/api";
import { formatMoney, inputClass } from "@/lib/teach";
import { PAYMENT_META, formatDate, type AdminPayment } from "@/lib/admin";
import { Pill } from "@/components/admin/ui";

const QUICK_REASONS = [
  "No transfer with this journal number in our bank statement.",
  "The amount paid doesn't match the course price.",
  "The screenshot is unclear. Please upload a clearer one.",
];

/**
 * Check one QR payment: the student's screenshot next to the journal number and amount.
 * Approving unlocks the course; rejecting tells the student why so they can submit again.
 */
export default function PaymentReview({ payment, onClose, onDone }: {
  payment: AdminPayment;
  onClose: () => void;
  onDone: (updated: AdminPayment) => void;
}) {
  const { push } = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const [proofUrl, setProofUrl] = useState("");
  const [proofError, setProofError] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  // Approving unlocks a paid course, so the admin confirms they checked the bank statement first.
  const [checked, setChecked] = useState(false);
  const pending = payment.status === "PENDING";

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  // The screenshot is private: fetch it with the admin's login, then show it from memory.
  useEffect(() => {
    if (!payment.has_proof) return;
    let url = "";
    apiBlob(`/manage/payments/${payment.reference}/proof/`)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setProofUrl(url);
      })
      .catch((err) => setProofError(errorMessage(err)));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [payment.reference, payment.has_proof]);

  const act = async (action: "approve" | "reject") => {
    if (action === "reject" && reason.trim().length < 5) return;
    setBusy(true);
    try {
      const updated = await api<AdminPayment>(`/manage/payments/${payment.reference}/${action}/`, {
        method: "POST",
        body: action === "reject" ? { reason: reason.trim() } : undefined,
      });
      push(action === "approve" ? `Approved. ${payment.student} can now open the course.` : "Rejected. The student has been told why.", "success");
      onDone(updated);
    } catch (err) {
      push(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="review-title"
      className="m-auto w-[min(920px,94vw)] max-h-[92vh] rounded-3xl p-0 backdrop:bg-black/50 bg-white"
    >
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-line">
        <h2 id="review-title" className="font-display text-xl font-semibold text-ink-strong">Verify payment</h2>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:bg-bg-soft bg-transparent border-none cursor-pointer">
          <X size={18} weight="bold" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 p-6 overflow-y-auto">
        {payment.bank ? (
          <div className="rounded-2xl bg-bg-soft p-6 flex flex-col gap-4">
            <p className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-muted">Paid from a bank account</p>
            {payment.bank.test && (
              <p className="rounded-xl bg-red-soft text-red-dark text-sm px-4 py-3">
                <strong>Test payment.</strong> The bank gateway isn&apos;t connected yet, so no money was taken. Don&apos;t approve it
                unless you&apos;re testing.
              </p>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              <dt className="text-ink-muted">Bank</dt><dd className="font-semibold text-ink-strong">{payment.bank.name}</dd>
              <dt className="text-ink-muted">Account</dt><dd className="font-semibold text-ink-strong tabular-nums">ending {payment.bank.account_last4}</dd>
              <dt className="text-ink-muted">Purpose</dt><dd className="text-ink-strong">{payment.bank.purpose || "—"}</dd>
              <dt className="text-ink-muted">Remarks</dt><dd className="text-ink-strong break-words">{payment.bank.remarks || "—"}</dd>
              <dt className="text-ink-muted">Paid</dt><dd className="text-ink-strong">{formatDate(payment.paid_at ?? payment.created_at)}</dd>
            </dl>
            <p className="text-xs text-ink-muted">The student received a receipt by email with these details.</p>
          </div>
        ) : (
        <div className="rounded-2xl bg-bg-soft min-h-[320px] flex items-center justify-center overflow-hidden">
          {proofUrl ? (
            <a href={proofUrl} target="_blank" rel="noopener noreferrer" title="Open full size">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proofUrl} alt={`Payment screenshot from ${payment.student}`} className="max-h-[70vh] w-auto object-contain" />
            </a>
          ) : (
            <p className="text-sm text-ink-muted flex items-center gap-2 p-6">
              <ImageBroken size={18} /> {payment.has_proof ? proofError || "Loading screenshot…" : "No screenshot attached."}
            </p>
          )}
        </div>
        )}

        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
            <dt className="text-ink-muted">{payment.bank ? "Transaction ref." : "Journal no."}</dt>
            <dd className="font-mono font-semibold text-ink-strong break-all">{payment.journal_number || "—"}</dd>
            <dt className="text-ink-muted">Amount due</dt>
            <dd className="font-semibold text-ink-strong">{formatMoney(payment.amount)}</dd>
            <dt className="text-ink-muted">Student</dt>
            <dd className="text-ink-strong">{payment.student}<span className="block text-xs text-ink-muted break-all">{payment.student_email}</span></dd>
            <dt className="text-ink-muted">Contact</dt>
            <dd>
              {payment.contact_number
                ? <a href={`tel:+975${payment.contact_number}`} className="font-semibold text-gold-dark hover:text-gold no-underline tabular-nums">{payment.contact_number}</a>
                : <span className="text-ink-muted">—</span>}
            </dd>
            <dt className="text-ink-muted">Course</dt>
            <dd className="text-ink-strong">{payment.course}</dd>
            <dt className="text-ink-muted">Submitted</dt>
            <dd className="text-ink-strong">{formatDate(payment.created_at)}</dd>
            <dt className="text-ink-muted">Status</dt>
            <dd><Pill className={PAYMENT_META[payment.status].className}>{PAYMENT_META[payment.status].label}</Pill></dd>
            {payment.reviewed_by && (<><dt className="text-ink-muted">Checked by</dt><dd className="text-ink-strong">{payment.reviewed_by} · {formatDate(payment.reviewed_at)}</dd></>)}
            {payment.failure_reason && (<><dt className="text-ink-muted">Reason</dt><dd className="text-red-dark">{payment.failure_reason}</dd></>)}
          </dl>

          {pending && !rejecting && (
            <label className="flex items-start gap-3 text-sm text-ink bg-gold-soft/50 rounded-xl px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="w-4 h-4 mt-0.5 accent-gold cursor-pointer flex-shrink-0" />
              <span>
                I found {payment.bank ? "transaction ref." : "journal no."} <strong className="font-mono">{payment.journal_number || "—"}</strong> in the bank statement,
                and the amount received is <strong>{formatMoney(payment.amount)}</strong>.
              </span>
            </label>
          )}

          {pending && !rejecting && (
            <div className="flex flex-col gap-2">
              <button type="button" disabled={busy || !checked} onClick={() => act("approve")} className="btn btn-md btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <CheckCircle size={17} weight="fill" /> {busy ? "Approving…" : "Approve and unlock course"}
              </button>
              {!checked && <p className="text-xs text-ink-muted text-center">Tick the box above once you've checked the bank statement.</p>}
              <button type="button" disabled={busy} onClick={() => setRejecting(true)} className="btn btn-md btn-outline-neutral inline-flex items-center justify-center gap-2">
                <XCircle size={17} /> Reject
              </button>
            </div>
          )}

          {pending && rejecting && (
            <div className="flex flex-col gap-3">
              <label htmlFor="reject-reason" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Reason (the student sees this)</label>
              <div className="flex flex-col gap-1.5">
                {QUICK_REASONS.map((r) => (
                  <button key={r} type="button" onClick={() => setReason(r)} className="text-left text-xs text-ink hover:text-gold-dark bg-bg-soft hover:bg-gold-soft/60 rounded-lg px-3 py-2 border-none cursor-pointer">
                    {r}
                  </button>
                ))}
              </div>
              <textarea id="reject-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} resize-y`} />
              <div className="flex gap-2">
                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => act("reject")} className="btn btn-md bg-red-dark text-white border-none disabled:opacity-50 cursor-pointer">
                  Reject payment
                </button>
                <button type="button" onClick={() => setRejecting(false)} className="btn btn-md btn-outline-neutral">Back</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
