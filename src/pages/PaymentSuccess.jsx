import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { PlayCircle, House } from "@phosphor-icons/react";
import { getCourseById } from "../data/courses";
import CourseThumb from "../components/CourseThumb";
import Mascot from "../components/Mascot";

export default function PaymentSuccess() {
  const { id } = useParams();
  const course = getCourseById(id);

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <section className="min-h-[100dvh] flex items-center justify-center px-8 py-32 bg-bg-soft aw-gold-wash">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[520px] bg-white border-2 border-line rounded-3xl p-8 md:p-10 text-center overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,182,6,0.35)_0%,transparent_70%)]" aria-hidden="true" />
        <div className="relative">
        <Mascot pose="celebrate" size={140} className="mx-auto mb-6" />
        <h1 className="font-display text-3xl tracking-tight font-semibold text-ink-strong mb-2">Payment successful</h1>
        <p className="text-sm text-ink-muted mb-8">You&apos;re enrolled. Your learning journey starts now.</p>

        {course && (
          <div className="flex gap-4 p-4 bg-bg-soft rounded-xl mb-8 text-left">
            <CourseThumb course={course} className="w-20 flex-shrink-0 !aspect-video" />
            <div>
              <h4 className="text-sm font-semibold text-ink-strong leading-snug">{course.title}</h4>
              <p className="text-xs text-ink-muted mt-1">{course.instructor.name}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Link to={`/learn/${id}`} className="btn btn-primary btn-lg btn-block">
            <PlayCircle size={16} /> Start Learning
          </Link>
          <Link to="/dashboard" className="btn btn-secondary btn-block">
            <House size={15} /> Go to Dashboard
          </Link>
        </div>
        </div>
      </motion.div>
      </section>
    </main>
  );
}
