"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bank, QrCode, Receipt, UploadSimple, ArrowRight, CheckCircle, Hourglass, Warning, X, ShieldCheck,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { useEnrollment } from "@/context/EnrollmentContext";
import { useToast } from "@/context/ToastContext";
import { useCatalog } from "@/context/CatalogContext";
import PageLoader from "@/components/PageLoader";
import BankPayment from "@/components/payment/BankPayment";
import RulesAgreement from "@/components/RulesAgreement";
import { api, errorMessage } from "@/lib/api";
import { fieldErrors } from "@/lib/teach";

interface QrSettings {
  ready: boolean;
  qr_image: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  instructions: string;
}

interface MyPayment {
  reference: string;
  provider: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  amount: number;
  journal_number: string;
  contact_number: string;
  failure_reason: string;
  created_at: string;
}

const MAX_MB = 5;
const inputClass =
  "w-full px-4 py-3.5 bg-bg-soft border-2 border-line rounded-xl text-sm text-ink-strong placeholder:text-ink-muted focus:border-gold focus:outline-none transition-colors";

/** Pay for a course with Lop-rig's bank QR, then send the journal number + screenshot for verification. */
export default function Checkout() {
  const params = useParams<{ id: string }>();
  const courseId = params?.id ?? "";
  const router = useRouter();
  const { getCourse, categories, ready } = useCatalog();
  const course = getCourse(courseId);
  const { user } = useAuth();
  const { isEnrolled } = useEnrollment();
  const { push } = useToast();

  // Pay from a bank account (RMA gateway) or by scanning Lop-rig's QR and sending the receipt.
  const [method, setMethod] = useState<"bank" | "qr">("bank");
  // Students accept the Rules and Regulations before they can pay and enroll.
  const [rulesOk, setRulesOk] = useState(false);
  const [qr, setQr] = useState<QrSettings | null>(null);
  const [latest, setLatest] = useState<MyPayment | null | undefined>(undefined);
  const [journal, setJournal] = useState("");
  const [phone, setPhone] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const preview = useMemo(() => (proof ? URL.createObjectURL(proof) : ""), [proof]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    if (!user) {
      push("Please log in to enroll in this course.", "info");
      router.push(`/login?from=${encodeURIComponent(`/checkout/${courseId}`)}`);
    }
  }, [user, courseId, push, router]);

  const enrolled = !!course && isEnrolled(course.id);
  const free = !!course && course.discountPrice === 0;
  useEffect(() => {
    // Nothing to pay for: send them to the lessons.
    if (course && (enrolled || free)) router.replace(`/learn/${course.id}`);
  }, [course, enrolled, free, router]);

  useEffect(() => {
    if (!user || !courseId) return;
    let alive = true;
    api<QrSettings>("/payments/qr/").then((s) => alive && setQr(s)).catch(() => alive && setQr(null));
    api<{ results: MyPayment[] }>(`/payments/?course=${encodeURIComponent(courseId)}`)
      .then((page) => {
        if (!alive) return;
        setLatest(page.results[0] ?? null);
        if (page.results[0]?.contact_number) setPhone((p) => p || page.results[0].contact_number);
      })
      .catch(() => alive && setLatest(null));
    return () => {
      alive = false;
    };
  }, [user, courseId]);

  if (!user) return null;
  if (!ready || latest === undefined) return <PageLoader />;

  if (!course) {
    return (
      <main className="overflow-x-hidden w-full max-w-full px-5 sm:px-8 lg:px-16 pt-36 pb-32 md:pb-48 aw-gold-wash">
        <div className="max-w-[1280px] mx-auto text-center">
          <h1 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong mb-4">Course not found</h1>
          <p className="text-ink-muted text-lg mb-8">The course you are trying to enroll in does not exist.</p>
          <Link href="/courses" className="btn btn-primary btn-lg">Browse courses</Link>
        </div>
      </main>
    );
  }
  if (enrolled || free) return <PageLoader />;

  const amount = course.discountPrice;
  const categoryTitle = categories.find((c) => c.id === course.category)?.title ?? course.category;
  const underReview = latest?.status === "PENDING";
  const rejected = latest?.status === "FAILED" ? latest : null;

  const pickProof = (file: File | undefined) => {
    setErrors((e) => ({ ...e, proof: "" }));
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setErrors((e) => ({ ...e, proof: "Choose a screenshot or photo (PNG, JPG or WebP)." }));
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrors((e) => ({ ...e, proof: `That image is too large. The limit is ${MAX_MB} MB.` }));
      return;
    }
    setProof(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!journal.trim()) next.journal_number = "Enter the journal number from your payment receipt.";
    if (!/^(\+?975)?\d{8}$/.test(phone.replace(/[\s().-]/g, ""))) next.contact_number = "Enter your 8-digit mobile number, e.g. 17123456.";
    if (!proof) next.proof = "Attach the screenshot of your payment.";
    setErrors(next);
    if (Object.keys(next).length || !proof) return;

    const form = new FormData();
    form.append("course", course.id);
    form.append("journal_number", journal.trim());
    form.append("contact_number", phone.trim());
    form.append("proof", proof);
    setSending(true);
    try {
      const payment = await api<MyPayment>("/payments/qr/submit/", { method: "POST", body: form });
      setLatest(payment);
      setJournal("");
      setProof(null);
      push("Payment details sent. We'll unlock the course once it's verified.", "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      if (!Object.keys(fields).length) push(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="overflow-x-hidden w-full max-w-full px-6 sm:px-8 lg:px-16 pt-36 pb-32 md:pb-48 aw-gold-wash">
      <div className="max-w-[1180px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12"
        >
          <Link href={`/courses/${course.id}`} className="text-xs font-bold text-gold-dark hover:text-gold no-underline">← Back to course</Link>
          <h1 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong mt-4">Enroll in {course.title}</h1>
          <p className="text-ink-muted text-lg mt-3">Pay straight from your bank account, or scan the QR code with any Bhutanese bank app.</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">
          <div className="flex flex-col gap-6">
            {underReview && latest && (
              <section className="bg-white border-2 border-emerald-300 rounded-2xl p-7 flex gap-4" aria-live="polite">
                <CheckCircle size={30} weight="fill" className="text-emerald-600 flex-shrink-0" />
                <div>
                  <h2 className="font-semibold text-ink-strong text-lg">You have already paid for this course</h2>
                  {latest.provider === "rma" ? (
                    <p className="text-sm text-ink mt-1">
                      We received <strong className="text-ink-strong">Nu. {latest.amount.toLocaleString()}</strong> from your bank account
                      (transaction ref. <strong className="text-ink-strong">{latest.journal_number}</strong>). Your receipt is in your
                      email, and we&apos;re unlocking the course for you. You&apos;ll get an email and a notification the moment
                      it&apos;s ready, usually within a day.
                    </p>
                  ) : (
                    <p className="text-sm text-ink mt-1">
                      We received journal number <strong className="text-ink-strong">{latest.journal_number}</strong> for{" "}
                      <strong className="text-ink-strong">Nu. {latest.amount.toLocaleString()}</strong>. An admin will check it against
                      the bank statement and unlock the course. You&apos;ll get a notification, usually within a day.
                    </p>
                  )}
                  <p className="inline-flex items-center gap-1.5 mt-3 text-xs text-ink-muted">
                    <Hourglass size={13} /> Waiting for the course to be unlocked. There&apos;s no need to pay again.
                  </p>
                  <Link href="/courses" className="inline-flex items-center gap-1 text-sm font-bold text-gold-dark hover:text-gold no-underline mt-4">
                    Keep browsing courses <ArrowRight size={13} weight="bold" />
                  </Link>
                </div>
              </section>
            )}

            {rejected && (
              <section className="bg-red-soft rounded-2xl p-6 flex gap-4" role="alert">
                <Warning size={24} weight="fill" className="text-red-dark flex-shrink-0" />
                <div className="text-sm text-ink">
                  <p className="font-semibold text-ink-strong">Your last payment couldn&apos;t be verified.</p>
                  <p className="mt-1">Reason: {rejected.failure_reason || "No reason given."}</p>
                  <p className="mt-1">Check the details below and submit again. If you were charged, keep your receipt.</p>
                </div>
              </section>
            )}

            {!underReview && (
              <RulesAgreement checked={rulesOk} onChange={setRulesOk} />
            )}

            {/* Payment stays locked (not clickable or focusable) until the rules are accepted. */}
            <div
              inert={!underReview && !rulesOk}
              aria-disabled={!underReview && !rulesOk}
              className={`flex flex-col gap-6 transition-opacity ${!underReview && !rulesOk ? "opacity-40 select-none" : ""}`}
            >
            {!underReview && (
              <div role="tablist" aria-label="How do you want to pay?" className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-white border-2 border-line">
                {([
                  { id: "bank", label: "Bank account", hint: "Pay from your account", icon: Bank },
                  { id: "qr", label: "Scan QR", hint: "mBoB, mPAY & more", icon: QrCode },
                ] as const).map(({ id, label, hint, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={method === id}
                    onClick={() => setMethod(id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left border-none cursor-pointer transition-colors ${
                      method === id ? "bg-ink-strong text-white" : "bg-transparent text-ink hover:bg-bg-soft"
                    }`}
                  >
                    <Icon size={22} weight={method === id ? "fill" : "regular"} className={method === id ? "text-gold" : "text-ink-muted"} />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{label}</span>
                      <span className={`block text-xs truncate ${method === id ? "text-white/60" : "text-ink-muted"}`}>{hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {!underReview && method === "bank" && (
              <BankPayment
                amount={amount}
                enrollment={{
                  courseId: course.id,
                  courseTitle: course.title,
                  category: categoryTitle,
                  level: course.level,
                  teacher: course.instructor.name,
                  lessons: course.lessonsCount,
                  duration: course.duration,
                  studentName: user.name,
                  studentEmail: user.email,
                }}
                payee={qr?.account_name ? { name: qr.account_name, bank: qr.bank_name, account: qr.account_number } : null}
                onPaid={(payment) => { setLatest(payment); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                onUseQr={() => { setMethod("qr"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              />
            )}

            {!underReview && method === "qr" && !qr?.ready && (
              <section className="bg-white border-2 border-line rounded-2xl p-8 text-center">
                <QrCode size={36} weight="duotone" className="text-ink-muted mx-auto" />
                <h2 className="font-semibold text-ink-strong mt-3">Payments open soon</h2>
                <p className="text-sm text-ink-muted mt-1">The payment QR code isn&apos;t set up yet. Please check back later.</p>
              </section>
            )}

            {!underReview && method === "qr" && qr?.ready && (
              <>
                {/* Step 1: pay */}
                <section className="bg-white border-2 border-line rounded-2xl p-7 md:p-8">
                  <Step n={1} title="Scan and pay" />
                  <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 mt-6 items-start">
                    <div className="rounded-2xl border-2 border-line p-3 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qr.qr_image} alt={`Payment QR code for ${qr.account_name}`} className="w-full aspect-square object-contain" />
                    </div>
                    <div className="flex flex-col gap-4 text-sm">
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                        <dt className="text-ink-muted">Amount</dt>
                        <dd className="font-bold text-ink-strong text-lg">Nu. {amount.toLocaleString()}</dd>
                        <dt className="text-ink-muted">Pay to</dt>
                        <dd className="font-semibold text-ink-strong">{qr.account_name}</dd>
                        {qr.bank_name && (<><dt className="text-ink-muted">Bank</dt><dd className="text-ink-strong">{qr.bank_name}</dd></>)}
                        {qr.account_number && (<><dt className="text-ink-muted">Account no.</dt><dd className="text-ink-strong tabular-nums">{qr.account_number}</dd></>)}
                      </dl>
                      <ol className="list-decimal pl-5 text-ink flex flex-col gap-1.5">
                        <li>Open mBoB, mPAY, DK Bank or any bank app and choose <strong>Scan QR</strong>.</li>
                        <li>Pay exactly <strong>Nu. {amount.toLocaleString()}</strong>. A different amount can delay verification.</li>
                        <li>Keep the success screen open, or take a screenshot of it.</li>
                      </ol>
                      {qr.instructions && <p className="text-ink-muted whitespace-pre-line">{qr.instructions}</p>}
                    </div>
                  </div>
                </section>

                {/* Step 2: proof */}
                <form onSubmit={submit} className="bg-white border-2 border-line rounded-2xl p-7 md:p-8 flex flex-col gap-6" noValidate>
                  <Step n={2} title="Send your receipt details" />
                  <div className="flex flex-col gap-2">
                    <label htmlFor="journal" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Journal number</label>
                    <input
                      id="journal"
                      value={journal}
                      onChange={(e) => setJournal(e.target.value)}
                      placeholder="e.g. 126-812333463"
                      autoComplete="off"
                      className={inputClass}
                      aria-invalid={!!errors.journal_number}
                      aria-describedby="journal-hint"
                    />
                    <p id="journal-hint" className={`text-xs ${errors.journal_number ? "text-red-dark" : "text-ink-muted"}`}>
                      {errors.journal_number || "Shown as “Jrnl. No” on the receipt. Type it exactly as it appears."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="phone" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Contact number</label>
                    <input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 17123456"
                      className={inputClass}
                      aria-invalid={!!errors.contact_number}
                      aria-describedby="phone-hint"
                    />
                    <p id="phone-hint" className={`text-xs ${errors.contact_number ? "text-red-dark" : "text-ink-muted"}`}>
                      {errors.contact_number || "We'll only call if we can't match your payment."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold text-ink-strong uppercase tracking-wider">Payment screenshot</span>
                    {proof && preview ? (
                      <div className="flex items-start gap-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt="Your payment screenshot" className="w-28 rounded-xl border border-line object-cover" />
                        <div className="text-sm">
                          <p className="text-ink-strong font-medium break-all">{proof.name}</p>
                          <button type="button" onClick={() => setProof(null)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-red-dark bg-transparent border-none cursor-pointer p-0">
                            <X size={12} weight="bold" /> Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl px-6 py-8 cursor-pointer transition-colors ${errors.proof ? "border-red-dark" : "border-line hover:border-gold"}`}>
                        <UploadSimple size={24} className="text-gold-dark" />
                        <span className="text-sm font-semibold text-ink-strong">Choose screenshot</span>
                        <span className="text-xs text-ink-muted">PNG, JPG or WebP, up to {MAX_MB} MB</span>
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => pickProof(e.target.files?.[0])} />
                      </label>
                    )}
                    {errors.proof && <p className="text-xs text-red-dark">{errors.proof}</p>}
                  </div>

                  {(errors.detail || errors.course) && <p role="alert" className="text-sm text-red-dark">{errors.detail || errors.course}</p>}

                  <button type="submit" disabled={sending} className="btn btn-primary btn-lg btn-block disabled:opacity-70">
                    {sending ? "Sending…" : <>I&apos;ve paid, submit for verification <ArrowRight size={15} weight="bold" /></>}
                  </button>
                </form>
              </>
            )}
            </div>
          </div>

          {/* Summary */}
          <aside className="bg-white border-2 border-line rounded-2xl p-7 lg:sticky lg:top-32 flex flex-col gap-5">
            <h2 className="text-sm font-bold text-ink-strong uppercase tracking-wider">Order summary</h2>
            <div>
              <h3 className="font-semibold text-ink-strong leading-snug">{course.title}</h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 mt-3 text-xs">
                <dt className="text-ink-muted">Category</dt><dd className="text-ink-strong font-medium">{categoryTitle}</dd>
                <dt className="text-ink-muted">Level</dt><dd className="text-ink-strong font-medium">{course.level}</dd>
                <dt className="text-ink-muted">Teacher</dt><dd className="text-ink-strong font-medium">{course.instructor.name}</dd>
                <dt className="text-ink-muted">Lessons</dt><dd className="text-ink-strong font-medium">{course.lessonsCount} · {course.duration}</dd>
              </dl>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-line">
              <span className="text-sm font-bold text-ink-strong">Total</span>
              <span className="text-xl font-bold text-ink-strong">Nu. {amount.toLocaleString()}</span>
            </div>
            <ul className="flex flex-col gap-3 text-sm text-ink">
              <li className="flex gap-2.5"><Receipt size={17} className="text-gold-dark flex-shrink-0" /> One payment unlocks one course.</li>
              <li className="flex gap-2.5"><ShieldCheck size={17} className="text-gold-dark flex-shrink-0" /> Your bank confirms every payment with a code.</li>
              <li className="flex gap-2.5"><CheckCircle size={17} className="text-gold-dark flex-shrink-0" /> Lifetime access once verified.</li>
            </ul>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-3 font-semibold text-ink-strong text-lg">
      <span className="w-8 h-8 rounded-full bg-ink-strong text-gold text-sm font-bold flex items-center justify-center">{n}</span>
      {title}
    </h2>
  );
}
