"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Buildings, CaretDown, CaretRight, Check, CheckCircle, Info, LockSimple, ShieldCheck, Spinner, UserCircle, Warning,
} from "@phosphor-icons/react";
import { ACCOUNT_DIGITS, BANKS, PAYMENT_PURPOSES, maskAccount, type Bank } from "@/lib/banks";
import {
  GatewayError, RMA_PREVIEW, accountInquiry, confirmDebit, recordPayment, requestDebit,
  type DebitRequest, type DebitStarted, type RecordedPayment,
} from "@/lib/rmaGateway";
import { ApiError, errorMessage } from "@/lib/api";

type Stage = "bank" | "details" | "confirm" | "otp" | "done" | "failed";
const STEPS: { id: Stage; label: string }[] = [
  { id: "bank", label: "Bank" },
  { id: "details", label: "Details" },
  { id: "confirm", label: "Confirm" },
  { id: "otp", label: "Verify" },
];
const REMARKS_MAX = 60;
const TPIN = /^\d{4,6}$/;
const RESEND_SECONDS = 30;

const inputClass =
  "w-full px-4 py-3.5 bg-bg-soft border-2 border-line rounded-xl text-sm text-ink-strong placeholder:text-ink-muted focus:border-gold focus:outline-none transition-colors";
const labelClass = "text-xs font-bold text-ink-strong uppercase tracking-wider";

const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface EnrollmentInfo {
  courseId: string;
  courseTitle: string;
  category: string;
  level: string;
  teacher: string;
  lessons: number;
  duration: string;
  studentName: string;
  studentEmail: string;
}

/** Lop-rig's company (joint) account that receives every course payment. */
export interface Payee {
  name: string;
  bank: string;
  account: string;
}

/**
 * Pay from your own bank account (RMA payment gateway): pick the bank, enter the account, check the
 * account holder's name, then approve with the code the bank sends by SMS.
 */
export default function BankPayment({ amount, enrollment, payee, onPaid, onUseQr }: {
  amount: number;
  enrollment: EnrollmentInfo;
  payee: Payee | null;
  /** Shown only when a payment fails: switch to paying by QR. */
  onUseQr: () => void;
  /** Called once the payment is recorded; the page then shows "You have already paid". */
  onPaid: (payment: RecordedPayment) => void;
}) {
  const { courseId, courseTitle, studentName } = enrollment;
  const [stage, setStage] = useState<Stage>("bank");
  const [bank, setBank] = useState<Bank | null>(null);
  // The bank list starts folded; the arrow next to "Select bank" opens it.
  const [listOpen, setListOpen] = useState(false);
  const [account, setAccount] = useState("");
  const [purpose, setPurpose] = useState<string>(PAYMENT_PURPOSES[0]);
  const [remarks, setRemarks] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [holder, setHolder] = useState("");
  const [inquiryError, setInquiryError] = useState("");
  const [agreed, setAgreed] = useState(false);
  // The student's bank T-PIN: kept only in this form, sent only to the bank, cleared right after.
  const [tpin, setTpin] = useState("");
  const [tpinError, setTpinError] = useState("");
  const [debit, setDebit] = useState<DebitStarted | null>(null);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [reference, setReference] = useState("");
  const [failure, setFailure] = useState<{ message: string; alreadyPaid: boolean } | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const go = (next: Stage) => {
    setStage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pickBank = (b: Bank) => {
    setBank(b);
    setHolder("");
    go("details");
  };

  // Details -> the bank looks up the account holder.
  const checkDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (account.length < ACCOUNT_DIGITS.min || account.length > ACCOUNT_DIGITS.max) {
      next.account = `Enter your ${bank?.name} account number (${ACCOUNT_DIGITS.min}–${ACCOUNT_DIGITS.max} digits).`;
    }
    if (!purpose) next.purpose = "Choose the purpose of this payment.";
    setErrors(next);
    if (Object.keys(next).length || !bank) return;

    setInquiryError("");
    setHolder("");
    setAgreed(false);
    go("confirm");
    setBusy(true);
    try {
      const result = await accountInquiry(bank.id, account, studentName);
      setHolder(result.holderName);
    } catch (err) {
      setInquiryError(err instanceof GatewayError ? err.message : "We couldn't reach the bank. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const debitRequest = (): DebitRequest | null =>
    bank ? { bankId: bank.id, accountNumber: account, amount, purpose, remarks: remarks.trim(), course: courseId } : null;

  // Confirm -> the bank sends an OTP to the account holder's phone.
  const startDebit = async (resend = false) => {
    const request = debitRequest();
    if (!request) return;
    if (!resend && !TPIN.test(tpin)) {
      setTpinError(`Enter your ${bank?.name} T-PIN (4 to 6 digits).`);
      return;
    }
    setBusy(true);
    setTpinError("");
    try {
      const started = await requestDebit(request, resend ? undefined : tpin);
      setDebit(started);
      setOtp("");
      setOtpError("");
      setResendIn(RESEND_SECONDS);
      go("otp");
    } catch (err) {
      if (err instanceof GatewayError && !resend) setTpinError(err.message);
      else setInquiryError("The bank couldn't start the payment. Please try again.");
    } finally {
      setTpin(""); // never kept after it's been used
      setBusy(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debit) return;
    if (!/^\d{6}$/.test(otp)) return setOtpError("Enter the 6-digit code from the SMS.");
    setBusy(true);
    setOtpError("");
    let result;
    try {
      result = await confirmDebit(debit.transactionId, otp);
    } catch (err) {
      // A wrong code: stay here so they can type it again.
      setOtpError(err instanceof GatewayError ? err.message : "We couldn't confirm the code. Please try again.");
      setBusy(false);
      return;
    }
    try {
      const request = debitRequest();
      if (!request) return;
      const payment = await recordPayment(request, result.reference);
      setReference(payment.journal_number);
      go("done");
      onPaid(payment);
    } catch (err) {
      // The payment didn't go through (or a payment for this course already exists).
      setFailure({ message: errorMessage(err), alreadyPaid: err instanceof ApiError && err.status === 409 });
      go("failed");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setOtp("");
    setOtpError("");
    await startDebit(true);
  };

  const stepIndex = STEPS.findIndex((s) => s.id === stage);

  return (
    <section className="bg-white border-2 border-line rounded-2xl overflow-hidden" aria-label="Pay from your bank account">
      {/* Gateway */}
      <div className="flex items-center gap-3 px-5 sm:px-8 py-3.5 border-b border-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/banks/rma.png" alt="Royal Monetary Authority of Bhutan" className="w-11 h-11 object-contain flex-shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-ink-strong text-sm">RMA Payment Gateway</span>
          <span className="block text-xs text-ink-muted truncate">Royal Monetary Authority of Bhutan</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 flex-shrink-0">
          <LockSimple size={14} weight="fill" /> <span className="hidden sm:inline">Secure payment</span>
        </span>
      </div>

      {/* Steps */}
      {stage !== "done" && stage !== "failed" && (
        <ol className="flex items-center gap-1 sm:gap-2 px-5 sm:px-8 py-5 border-b border-line bg-bg-soft/60 list-none m-0">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            return (
              <li key={s.id} className="flex items-center gap-1 sm:gap-2 flex-1 last:flex-none" aria-current={current ? "step" : undefined}>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                  done ? "bg-emerald-600 text-white" : current ? "bg-ink-strong text-gold" : "bg-white border-2 border-line text-ink-muted"
                }`}>
                  {done ? <Check size={13} weight="bold" /> : i + 1}
                </span>
                <span className={`text-xs sm:text-sm font-semibold ${current ? "text-ink-strong" : "text-ink-muted"} hidden sm:inline`}>{s.label}</span>
                {i < STEPS.length - 1 && <span className={`h-0.5 flex-1 rounded-full ${done ? "bg-emerald-600" : "bg-line"}`} aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      )}

      <div className="p-6 sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
          >
            {stage === "bank" && (
              <div>
                <button
                  type="button"
                  onClick={() => setListOpen((o) => !o)}
                  aria-expanded={listOpen}
                  aria-controls="rma-bank-list"
                  className="group w-full flex items-center justify-between gap-4 text-left bg-transparent border-none cursor-pointer p-0"
                >
                  <span>
                    <span className="block font-semibold text-ink-strong text-lg">Select bank</span>
                    <span className="block text-sm text-ink-muted mt-1">
                      {listOpen
                        ? "The bank account you'll pay from."
                        : bank ? `${bank.name} selected. Show the list to change it.` : `${BANKS.length} banks available. Show the list to choose.`}
                    </span>
                  </span>
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-line text-ink-muted group-hover:border-gold group-hover:text-ink-strong transition-colors"
                    title={listOpen ? "Hide banks" : "Show banks"}
                  >
                    <CaretDown size={16} weight="bold" className={`transition-transform duration-300 ${listOpen ? "rotate-180" : ""}`} />
                    <span className="sr-only">{listOpen ? "Hide banks" : "Show banks"}</span>
                  </span>
                </button>
                <AnimatePresence initial={false}>
                {listOpen && (
                <motion.ul
                  id="rma-bank-list"
                  key="banks"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-5 flex flex-col gap-1 list-none p-0 overflow-hidden"
                  role="list"
                >
                  {BANKS.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => pickBank(b)}
                        className={`group w-full flex items-center gap-4 px-3 py-3 rounded-xl border-2 text-left cursor-pointer transition-colors ${
                          bank?.id === b.id ? "border-gold bg-gold-soft/50" : "border-transparent bg-transparent hover:bg-bg-soft"
                        }`}
                      >
                        <BankLogo bank={b} />
                        <span className="flex-1 font-medium text-ink-strong">{b.name}</span>
                        <CaretRight size={16} weight="bold" className="text-ink-muted group-hover:text-ink-strong transition-colors" />
                      </button>
                    </li>
                  ))}
                </motion.ul>
                )}
                </AnimatePresence>
              </div>
            )}

            {stage === "details" && bank && (
              <form onSubmit={checkDetails} noValidate className="flex flex-col gap-6">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-soft">
                  <BankLogo bank={bank} />
                  <span className="flex-1 font-semibold text-ink-strong">{bank.name}</span>
                  <button type="button" onClick={() => { setListOpen(true); go("bank"); }} className="text-xs font-bold text-gold-dark hover:text-gold bg-transparent border-none cursor-pointer">
                    Change
                  </button>
                </div>

                <EnrollmentCard enrollment={enrollment} />

                <div className="flex flex-col gap-2">
                  <label htmlFor="rma-account" className={labelClass}>Account number</label>
                  <input
                    id="rma-account"
                    inputMode="numeric"
                    autoComplete="off"
                    value={account}
                    onChange={(e) => setAccount(e.target.value.replace(/\D/g, "").slice(0, ACCOUNT_DIGITS.max))}
                    placeholder="e.g. 200123456789"
                    className={`${inputClass} tabular-nums tracking-wider`}
                    aria-invalid={!!errors.account}
                    aria-describedby="rma-account-hint"
                  />
                  <p id="rma-account-hint" className={`text-xs ${errors.account ? "text-red-dark" : "text-ink-muted"}`}>
                    {errors.account || "Digits only. We'll check it with your bank before anything is paid."}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <span className={labelClass}>Amount (BTN)</span>
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border-2 border-line bg-bg-soft">
                    <span className="text-lg font-bold text-ink-strong tabular-nums">Nu. {money(amount)}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted"><LockSimple size={13} weight="bold" /> Course fee</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="rma-purpose" className={labelClass}>Purpose</label>
                  <select
                    id="rma-purpose"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className={`${inputClass} cursor-pointer`}
                    aria-invalid={!!errors.purpose}
                  >
                    {PAYMENT_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {errors.purpose && <p className="text-xs text-red-dark">{errors.purpose}</p>}
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="rma-remarks" className={labelClass}>Remarks <span className="font-normal normal-case tracking-normal text-ink-muted">(optional)</span></label>
                  <input
                    id="rma-remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value.slice(0, REMARKS_MAX))}
                    placeholder={`e.g. ${enrollment.category}: ${courseTitle}`.slice(0, REMARKS_MAX)}
                    className={inputClass}
                  />
                  <p className="text-xs text-ink-muted text-right tabular-nums">{remarks.length}/{REMARKS_MAX}</p>
                </div>

                <button type="submit" className="btn btn-primary btn-lg btn-block">
                  Continue <ArrowRight size={15} weight="bold" />
                </button>
              </form>
            )}

            {stage === "confirm" && bank && (
              <div className="flex flex-col gap-6">
                <h2 className="font-semibold text-ink-strong text-lg">Confirm your payment</h2>

                {/* Account holder check */}
                {busy && !holder ? (
                  <div className="flex items-center gap-3 p-5 rounded-xl bg-bg-soft" role="status">
                    <Spinner size={22} className="text-gold-dark animate-spin" />
                    <span className="text-sm text-ink">Checking the account with {bank.name}…</span>
                  </div>
                ) : inquiryError ? (
                  <div className="flex gap-3 p-5 rounded-xl bg-red-soft" role="alert">
                    <Warning size={22} weight="fill" className="text-red-dark flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-semibold text-ink-strong">Account not verified</p>
                      <p className="text-ink mt-1">{inquiryError}</p>
                      <button type="button" onClick={() => go("details")} className="mt-3 text-xs font-bold text-red-dark bg-transparent border-none cursor-pointer p-0">
                        Edit account number
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-4 p-5 rounded-xl border-2 border-emerald-200 bg-emerald-50">
                    <UserCircle size={40} weight="duotone" className="text-emerald-700 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
                        <CheckCircle size={14} weight="fill" /> Account verified
                      </p>
                      <p className="text-lg font-bold text-ink-strong mt-1 break-words">{holder}</p>
                      <p className="text-sm text-ink mt-1">Is this you? The name must match the owner of this account.</p>
                    </div>
                  </div>
                )}

                <EnrollmentCard enrollment={enrollment} />

                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm rounded-xl border-2 border-line p-5">
                  <dt className="col-span-2 text-[0.7rem] font-bold uppercase tracking-wider text-ink-muted">Paying from</dt>
                  <dt className="text-ink-muted">Bank</dt>
                  <dd className="flex items-center gap-2 font-semibold text-ink-strong"><BankLogo bank={bank} size="sm" /> {bank.name}</dd>
                  <dt className="text-ink-muted">Account</dt>
                  <dd className="font-semibold text-ink-strong tabular-nums">{maskAccount(account)}</dd>
                  <dt className="text-ink-muted">Amount</dt>
                  <dd className="font-bold text-ink-strong tabular-nums">BTN {money(amount)}</dd>
                  <dt className="text-ink-muted">Purpose</dt>
                  <dd className="text-ink-strong">{purpose}</dd>
                  {remarks.trim() && (<><dt className="text-ink-muted">Remarks</dt><dd className="text-ink-strong break-words">{remarks.trim()}</dd></>)}
                </dl>

                <PayeeCard payee={payee} />

                {holder && (
                  <label className="flex items-start gap-3 text-sm text-ink cursor-pointer">
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-gold cursor-pointer" />
                    <span>I&apos;m <strong className="text-ink-strong">{holder}</strong> and I authorise {bank.name} to pay <strong className="text-ink-strong">BTN {money(amount)}</strong> from this account into Lop-rig&apos;s company account for <strong className="text-ink-strong">{courseTitle}</strong>.</span>
                  </label>
                )}

                {holder && (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="rma-tpin" className={labelClass}>{bank.name} T-PIN</label>
                    <input
                      id="rma-tpin"
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={6}
                      value={tpin}
                      onChange={(e) => { setTpin(e.target.value.replace(/\D/g, "").slice(0, 6)); setTpinError(""); }}
                      placeholder="••••"
                      className={`${inputClass} max-w-[220px] text-center text-lg tracking-[0.5em]`}
                      aria-invalid={!!tpinError}
                      aria-describedby="rma-tpin-hint"
                    />
                    <p id="rma-tpin-hint" role={tpinError ? "alert" : undefined} className={`text-xs ${tpinError ? "text-red-dark" : "text-ink-muted"}`}>
                      {tpinError || "Your bank's transaction PIN. It goes only to your bank; Lop-rig never sees or keeps it."}
                    </p>
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  <button type="button" onClick={() => go("details")} className="btn btn-lg btn-outline-neutral inline-flex items-center justify-center gap-2">
                    <ArrowLeft size={15} weight="bold" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={() => startDebit()}
                    disabled={!holder || !agreed || busy || !TPIN.test(tpin)}
                    className="btn btn-primary btn-lg flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy && holder ? "Sending code…" : <>Confirm and get code <ArrowRight size={15} weight="bold" /></>}
                  </button>
                </div>
              </div>
            )}

            {stage === "otp" && bank && debit && (
              <form onSubmit={verifyOtp} noValidate className="flex flex-col gap-6">
                <div className="text-center">
                  <span className="w-14 h-14 mx-auto rounded-2xl bg-gold-soft text-gold-dark flex items-center justify-center">
                    <ShieldCheck size={28} weight="duotone" />
                  </span>
                  <h2 className="font-semibold text-ink-strong text-lg mt-4">Enter the code from {bank.name}</h2>
                  <p className="text-sm text-ink-muted mt-1">
                    We sent a 6-digit code to the mobile number registered with your account ({debit.otpSentTo}).
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="rma-otp" className="sr-only">One-time code</label>
                  <input
                    id="rma-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••"
                    className="w-full px-4 py-4 bg-white border-2 border-line rounded-xl text-center font-display text-2xl font-semibold tracking-[0.5em] text-ink-strong placeholder:text-line-strong focus:border-gold focus:outline-none transition-colors"
                    aria-invalid={!!otpError}
                    aria-describedby="rma-otp-hint"
                  />
                  <p id="rma-otp-hint" role={otpError ? "alert" : undefined} className={`text-xs text-center ${otpError ? "text-red-dark" : "text-ink-muted"}`}>
                    {otpError || `Paying BTN ${money(amount)} from ${maskAccount(account)}.`}
                  </p>
                </div>
                <button type="submit" disabled={busy || otp.length !== 6} className="btn btn-primary btn-lg btn-block disabled:opacity-50 disabled:cursor-not-allowed">
                  {busy ? "Confirming…" : `Pay BTN ${money(amount)}`}
                </button>
                <p className="text-center text-sm text-ink-muted">
                  Didn&apos;t get it?{" "}
                  {resendIn > 0 ? (
                    <span className="tabular-nums">Send again in {resendIn}s</span>
                  ) : (
                    <button type="button" onClick={resend} disabled={busy} className="font-bold text-gold-dark hover:text-gold bg-transparent border-none cursor-pointer p-0">
                      Send a new code
                    </button>
                  )}
                </p>
              </form>
            )}

            {stage === "done" && bank && (
              <div className="text-center py-4">
                <span className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle size={40} weight="fill" />
                </span>
                <h2 className="font-display text-2xl font-semibold text-ink-strong mt-4">Payment received</h2>
                <p className="text-sm text-ink mt-2 max-w-[460px] mx-auto">
                  BTN {money(amount)} paid from {bank.name} {maskAccount(account)}. We&apos;ve emailed your receipt to{" "}
                  <strong className="text-ink-strong">{enrollment.studentEmail}</strong>, and we&apos;ll unlock the course shortly.
                </p>
                <p className="text-xs text-ink-muted mt-3">Transaction ref. {reference}</p>
              </div>
            )}

            {/* Only when the payment didn't work: offer another way to pay. */}
            {stage === "failed" && failure && (
              <div className="text-center py-4" role="alert">
                <span className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${failure.alreadyPaid ? "bg-emerald-50 text-emerald-600" : "bg-red-soft text-red-dark"}`}>
                  {failure.alreadyPaid ? <CheckCircle size={40} weight="fill" /> : <Warning size={36} weight="fill" />}
                </span>
                <h2 className="font-display text-2xl font-semibold text-ink-strong mt-4">
                  {failure.alreadyPaid ? "You have already paid for this course" : "The payment didn't go through"}
                </h2>
                <p className="text-sm text-ink mt-2 max-w-[460px] mx-auto">
                  {failure.alreadyPaid
                    ? "There's no need to pay again. We're unlocking the course and will email you when it's ready."
                    : `${failure.message} No money was taken for this attempt. You can try again, or pay by scanning the QR code.`}
                </p>
                {!failure.alreadyPaid && (
                  <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                    <button type="button" onClick={onUseQr} className="btn btn-primary btn-lg">Pay with Scan QR instead</button>
                    <button type="button" onClick={() => { setFailure(null); setOtp(""); go("confirm"); }} className="btn btn-lg btn-outline-neutral">
                      Try again
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {RMA_PREVIEW && stage !== "done" && stage !== "failed" && (
          <p className="mt-6 flex items-start gap-2 text-xs text-ink-muted rounded-xl bg-bg-soft px-4 py-3">
            <Info size={15} className="flex-shrink-0 mt-px" />
            <span>
              Test mode: the bank gateway isn&apos;t connected yet, so no bank is contacted and no money moves. The payment is
              still recorded and you get a test receipt by email. An account number ending in 0000 shows &ldquo;not found&rdquo;; the T-PIN 0000 is &ldquo;wrong&rdquo;;
              the code 000000 is &ldquo;wrong&rdquo;.
            </span>
          </p>
        )}
      </div>
    </section>
  );
}

function BankLogo({ bank, size = "md" }: { bank: Bank; size?: "sm" | "md" }) {
  const box = size === "sm" ? "w-6 h-6 text-[0.5rem]" : "w-10 h-10 text-[0.7rem]";
  if (bank.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={bank.logo} alt="" aria-hidden="true" className={`${box} rounded-full object-contain bg-white flex-shrink-0`} />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${box} rounded-full flex items-center justify-center font-black tracking-tight flex-shrink-0`}
      style={{ background: bank.color, color: bank.accent }}
    >
      {bank.initials}
    </span>
  );
}

/** What the student is enrolling in, so the payment is never ambiguous. */
function EnrollmentCard({ enrollment: e }: { enrollment: EnrollmentInfo }) {
  return (
    <div className="rounded-xl border-2 border-gold/40 bg-gold-soft/40 p-5">
      <p className="text-[0.7rem] font-bold uppercase tracking-wider text-gold-dark">You&apos;re enrolling in</p>
      <p className="text-base font-bold text-ink-strong mt-1 leading-snug">{e.courseTitle}</p>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 mt-4 text-sm">
        <div><dt className="text-xs text-ink-muted">Category</dt><dd className="font-semibold text-ink-strong">{e.category}</dd></div>
        <div><dt className="text-xs text-ink-muted">Level</dt><dd className="font-semibold text-ink-strong">{e.level}</dd></div>
        <div><dt className="text-xs text-ink-muted">Teacher</dt><dd className="font-semibold text-ink-strong">{e.teacher}</dd></div>
        <div><dt className="text-xs text-ink-muted">Lessons</dt><dd className="font-semibold text-ink-strong">{e.lessons} · {e.duration}</dd></div>
        <div className="col-span-2"><dt className="text-xs text-ink-muted">Student</dt><dd className="font-semibold text-ink-strong break-all">{e.studentName} · {e.studentEmail}</dd></div>
      </dl>
    </div>
  );
}

/** The company account the money goes into. */
function PayeeCard({ payee }: { payee: Payee | null }) {
  return (
    <div className="rounded-xl border-2 border-line p-5 text-sm">
      <p className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-muted">Paid into</p>
      <p className="flex items-center gap-2 mt-2 font-bold text-ink-strong">
        <Buildings size={18} weight="duotone" className="text-gold-dark flex-shrink-0" />
        {payee?.name || "Lop-rig"}
      </p>
      {payee && (payee.bank || payee.account) && (
        <p className="text-ink mt-1">
          {payee.bank}{payee.bank && payee.account ? " · " : ""}{payee.account && <span className="tabular-nums">A/c {maskAccount(payee.account)}</span>}
        </p>
      )}
      <p className="text-xs text-ink-muted mt-2">Lop-rig&apos;s company account.</p>
    </div>
  );
}
