import { useState, useRef, useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Phone, Bank, CreditCard, Wallet, Shield, Spinner } from "@phosphor-icons/react";
import { getCourseById } from "../data/courses";
import { useAuth } from "../context/AuthContext";
import { useEnrollment } from "../context/EnrollmentContext";
import CourseThumb from "../components/CourseThumb";
import EmptyState from "../components/EmptyState";

const METHODS = [
  { id: "mobile", label: "Mobile Banking", desc: "mBoB, BOBiL, DK Bank Mobile (demo)", icon: Phone },
  { id: "bank", label: "Bank Transfer", desc: "BOB, BNB, DPNB, T Bank (demo)", icon: Bank },
  { id: "card", label: "Card", desc: "Visa / Mastercard (demo)", icon: CreditCard },
  { id: "wallet", label: "Digital Wallet", desc: "MyPay, PayEase (demo)", icon: Wallet },
];

export default function Checkout() {
  const { id } = useParams();
  const course = getCourseById(id);
  const { user } = useAuth();
  const { enroll } = useEnrollment();
  const navigate = useNavigate();
  const [method, setMethod] = useState("mobile");
  const [processing, setProcessing] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  if (!user) return <Navigate to="/login" state={{ from: `/checkout/${id}` }} replace />;
  if (!course) {
    return (
      <div className="min-h-[60dvh] flex items-center justify-center px-8">
        <EmptyState
          pose="sad"
          title="Course not found"
          ctaLabel="Browse courses"
          ctaTo="/courses"
        />
      </div>
    );
  }

  const discount = course.price - course.discountPrice;

  const handlePay = () => {
    setProcessing(true);
    timeoutRef.current = setTimeout(() => {
      enroll(course.id);
      navigate(`/payment-success/${course.id}`);
    }, 1800);
  };

  return (
    <main className="overflow-x-hidden w-full max-w-full px-8 lg:px-16 pt-36 pb-32 md:pb-48 aw-gold-wash">
      <div className="max-w-[1280px] mx-auto">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-16"
        >
          <h1 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong w-full max-w-4xl">Complete your enrollment</h1>
          <p className="text-ink-muted text-lg mt-3">Secure checkout. Lifetime access, starting today.</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-12">

          {/* Payment Methods */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <h2 className="text-lg font-semibold text-ink-strong mb-6">Payment method</h2>
            <div className="flex flex-col gap-3 mb-6">
              {METHODS.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-center gap-4 p-5 border-2 rounded-xl cursor-pointer transition-all ${
                    method === m.id
                      ? "border-gold bg-gold-soft shadow-[0_4px_16px_rgba(255,182,6,0.12)]"
                      : "border-line bg-white hover:border-gold"
                  }`}
                >
                  <input type="radio" name="method" checked={method === m.id} onChange={() => setMethod(m.id)} className="sr-only" />
                  <span className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${method === m.id ? "bg-gold text-ink-strong" : "bg-bg-soft text-ink-muted"}`}>
                    <m.icon size={20} weight="duotone" />
                  </span>
                  <span className="flex flex-col">
                    <strong className="text-sm text-ink-strong">{m.label}</strong>
                    <span className="text-xs text-ink-muted">{m.desc}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-ink-muted flex items-center gap-2 bg-bg-soft p-4 rounded-lg">
              <Shield size={14} weight="duotone" className="text-gold-dark flex-shrink-0" />
              This is a simulated payment flow for demo purposes. No real transaction will be made.
            </p>
          </motion.div>

          {/* Order Summary */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="lg:sticky lg:top-32 self-start"
          >
            <div className="bg-white border-2 border-line rounded-xl p-7">
              <h2 className="text-lg font-semibold text-ink-strong mb-6">Order summary</h2>
              <div className="flex gap-4 mb-6">
                <CourseThumb course={course} className="w-20 flex-shrink-0 !aspect-video" />
                <div>
                  <h4 className="text-sm font-semibold text-ink-strong leading-snug">{course.title}</h4>
                  <p className="text-xs text-ink-muted mt-1">{course.instructor.name}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 text-sm border-t border-line pt-4">
                <div className="flex justify-between text-ink-muted">
                  <span>Original price</span>
                  <span>Nu. {course.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-red">
                  <span>Discount</span>
                  <span>- Nu. {discount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-ink-strong text-base border-t border-line pt-3">
                  <span>Total</span>
                  <span>Nu. {course.discountPrice.toLocaleString()}</span>
                </div>
              </div>

              <button
                className="btn btn-primary btn-lg btn-block mt-6"
                onClick={handlePay}
                disabled={processing}
              >
                {processing ? (
                  <><Spinner size={16} className="animate-spin" /> Processing...</>
                ) : (
                  `Pay Nu. ${course.discountPrice.toLocaleString()}`
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
