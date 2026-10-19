"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CreditCard, Lock, ArrowRight, DeviceMobile, Bank } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { useEnrollment } from "@/context/EnrollmentContext";
import { useToast } from "@/context/ToastContext";
import { getCourseById } from "@/data/courses";

const methods = [
  {
    id: "mobile",
    name: "Mobile Banking",
    desc: "Pay instantly with mBoB, DK Bank, or MyPay",
    icon: DeviceMobile,
  },
  {
    id: "card",
    name: "Credit / Debit Card",
    desc: "Visa, Mastercard, and UnionPay accepted",
    icon: CreditCard,
  },
  {
    id: "bank",
    name: "Bank Transfer",
    desc: "Transfer to our Bhutanese bank account",
    icon: Bank,
  },
];

export default function Checkout() {
  const params = useParams<{ id: string }>();
  const courseId = params?.id ?? "";
  const router = useRouter();
  const course = getCourseById(courseId);
  const { user } = useAuth();
  const { enroll } = useEnrollment();
  const { push } = useToast();
  const [selected, setSelected] = useState("mobile");
  const [processing, setProcessing] = useState(false);
  const [orderNote, setOrderNote] = useState("");

  useEffect(() => {
    if (!user) {
      push("Please log in to continue to checkout.", "info");
      router.push(`/login?from=${encodeURIComponent(`/checkout/${courseId}`)}`);
    }
  }, [user, courseId, push, router]);

  if (!user) return null;

  if (!course) {
    return (
      <main className="overflow-x-hidden w-full max-w-full px-8 lg:px-16 pt-36 pb-32 md:pb-48 aw-gold-wash">
        <div className="max-w-[1280px] mx-auto text-center">
          <h1 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong mb-4">Course not found</h1>
          <p className="text-ink-muted text-lg mb-8">The course you are trying to purchase does not exist.</p>
          <Link href="/courses" className="btn btn-primary btn-lg">Browse courses</Link>
        </div>
      </main>
    );
  }

  const discount = course.price - course.discountPrice;

  const handlePay = () => {
    if (processing) return;
    setProcessing(true);
    setTimeout(() => {
      enroll(course.id);
      push("Payment successful. You're enrolled!", "success");
      router.push(`/payment-success/${course.id}`);
    }, 1600);
  };

  return (
    <main className="overflow-x-hidden w-full max-w-full px-8 lg:px-16 pt-36 pb-32 md:pb-48 aw-gold-wash">
      <div className="max-w-[1280px] mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-14"
        >
          <div>
            <h1 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong">Checkout</h1>
            <p className="text-ink-muted text-lg mt-3">Secure payment · Instant access after purchase</p>
          </div>
          <span className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-bold px-4 py-2 rounded-full">
            <Lock size={13} weight="bold" /> Secure checkout
          </span>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 items-start">
          {/* Payment form */}
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }}
            className="bg-white border-2 border-line rounded-2xl p-8 flex flex-col gap-8"
          >
            {/* Course */}
            <div className="flex gap-5 pb-8 border-b border-line">
              <img
                src={`https://picsum.photos/seed/checkout${course.id}/400/225`}
                alt=""
                aria-hidden="true"
                className="w-28 h-[63px] rounded-lg object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <span className="text-[0.65rem] font-bold text-gold-dark uppercase tracking-widest">{course.category.replace("-", " ")}</span>
                <h2 className="font-semibold text-ink-strong mt-1 line-clamp-2">{course.title}</h2>
                <p className="text-xs text-ink-muted mt-1">{course.instructor.name}</p>
              </div>
            </div>

            {/* Payment method */}
            <section>
              <h3 className="text-sm font-bold text-ink-strong uppercase tracking-wider mb-4">Payment method</h3>
              <div className="flex flex-col gap-3">
                {methods.map((m) => {
                  const active = selected === m.id;
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center gap-4 p-5 border-2 rounded-xl cursor-pointer transition-all ${
                        active ? "border-gold bg-gold-soft/60" : "border-line hover:border-gold"
                      }`}
                    >
                      <input
                        type="radio"
                        name="method"
                        checked={active}
                        onChange={() => setSelected(m.id)}
                        className="accent-gold w-4 h-4"
                      />
                      <span className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? "bg-gold text-ink-strong" : "bg-bg-sunken text-ink-muted"}`}>
                        <m.icon size={20} weight="duotone" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-bold text-ink-strong">{m.name}</span>
                        <span className="block text-xs text-ink-muted mt-0.5">{m.desc}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Billing details */}
            <section>
              <h3 className="text-sm font-bold text-ink-strong uppercase tracking-wider mb-4">Billing details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label htmlFor="billing-name" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Full name</label>
                  <input
                    id="billing-name"
                    defaultValue={user.name}
                    className="w-full px-4 py-3.5 bg-bg-soft border-2 border-line rounded-xl text-sm text-ink-strong focus:border-gold focus:outline-none transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="billing-email" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Email</label>
                  <input
                    id="billing-email"
                    type="email"
                    defaultValue={user.email}
                    className="w-full px-4 py-3.5 bg-bg-soft border-2 border-line rounded-xl text-sm text-ink-strong focus:border-gold focus:outline-none transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label htmlFor="billing-note" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Order note (optional)</label>
                  <textarea
                    id="billing-note"
                    rows={3}
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Any special instructions for your order…"
                    className="w-full px-4 py-3.5 bg-bg-soft border-2 border-line rounded-xl text-sm text-ink-strong placeholder:text-ink-muted focus:border-gold focus:outline-none transition-colors resize-none"
                  />
                </div>
              </div>
            </section>

            <p className="text-xs text-ink-muted flex items-center gap-2 bg-bg-soft px-4 py-3 rounded-lg">
              <Lock size={13} weight="bold" className="text-gold-dark flex-shrink-0" />
              This is a simulated checkout for demo purposes. No real payment will be processed.
            </p>
          </motion.div>

          {/* Order summary */}
          <motion.aside
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }}
            className="bg-white border-2 border-line rounded-2xl p-8 lg:sticky lg:top-32 flex flex-col gap-6"
          >
            <h2 className="text-sm font-bold text-ink-strong uppercase tracking-wider">Order summary</h2>

            <div className="flex gap-5 pb-6 border-b border-line">
              <img
                src={`https://picsum.photos/seed/summary${course.id}/400/225`}
                alt=""
                aria-hidden="true"
                className="w-20 h-[45px] rounded-lg object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-ink-strong text-sm leading-snug line-clamp-2">{course.title}</h3>
                <p className="text-xs text-ink-muted mt-1">{course.instructor.name}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">List price</span>
                <span className="text-sm text-ink line-through">Nu. {course.price.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">Discount</span>
                <span className="text-sm font-bold text-emerald-600">− Nu. {discount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-line">
                <span className="text-sm font-bold text-ink-strong">Total</span>
                <span className="text-xl font-bold text-ink-strong">Nu. {course.discountPrice.toLocaleString()}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePay}
              disabled={processing}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-full font-bold text-sm tracking-wide transition-all cursor-pointer border-none bg-ink-strong text-white hover:bg-black ${
                processing ? "opacity-80 cursor-wait" : ""
              }`}
            >
              {processing ? (
                <>Processing payment…</>
              ) : (
                <>Pay Nu. {course.discountPrice.toLocaleString()} <ArrowRight size={15} weight="bold" /></>
              )}
            </button>

            <p className="text-[0.7rem] text-ink-muted text-center flex items-center justify-center gap-1.5">
              <Lock size={11} weight="bold" /> 256-bit SSL encrypted
            </p>

            <Link href={`/courses/${course.id}`} className="text-xs font-bold text-gold-dark hover:text-gold transition-colors text-center no-underline">
              ← Back to course
            </Link>
          </motion.aside>
        </div>
      </div>
    </main>
  );
}