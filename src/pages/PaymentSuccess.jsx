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
    <main className="min-h-[100dvh] flex items-center justify-center px-8 py-32 bg-bg-soft">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[460px] bg-white border-2 border-line rounded-xl p-8 md:p-10 text-center"
      >
        <Mascot pose="celebrate" size={140} className="mx-auto mb-6" />
        <h1 className="text-2xl font-semibold text-ink-strong mb-2">Payment Successful</h1>
        <p className="text-sm text-ink-muted mb-8">You&apos;re enrolled in this course.</p>

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
          <Link to={`/learn/${id}`} className="btn btn-primary btn-block">
            <PlayCircle size={16} /> Start Learning
          </Link>
          <Link to="/dashboard" className="btn btn-secondary btn-block">
            <House size={15} /> Go to Dashboard
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
