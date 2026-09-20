import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Book, Clock, Trophy, PlayCircle, ArrowRight, Fire, Diamond } from "@phosphor-icons/react";
import { useAuth } from "../context/AuthContext";
import { useEnrollment } from "../context/EnrollmentContext";
import CourseThumb from "../components/CourseThumb";
import ProgressBar from "../components/ProgressBar";
import CourseCard from "../components/CourseCard";
import StatCard from "../components/StatCard";
import ProgressRing from "../components/ProgressRing";
import EmptyState from "../components/EmptyState";
import { courses } from "../data/courses";

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

export default function Dashboard() {
  const { user } = useAuth();
  const { enrolledCourses, getProgress, enrollments, streak, xp } = useEnrollment();

  const inProgress = enrolledCourses
    .map((c) => ({ course: c, progress: getProgress(c.id) }))
    .sort((a, b) => a.progress - b.progress);

  const continueCourse = inProgress.find((c) => c.progress < 100) || inProgress[0];
  const completedCount = inProgress.filter((c) => c.progress === 100).length;
  const totalHours = enrolledCourses.reduce((sum, c) => sum + parseFloat(c.duration), 0);
  const overallCompletion = enrolledCourses.length
    ? Math.round(inProgress.reduce((sum, c) => sum + c.progress, 0) / inProgress.length)
    : 0;

  const recommended = courses.filter((c) => !enrollments[c.id]?.enrolledAt).slice(0, 4);

  return (
    <main className="overflow-x-hidden w-full max-w-full px-8 lg:px-16 pt-36 pb-32 md:pb-48 aw-gold-wash">
      <div className="max-w-[1280px] mx-auto">

        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-16"
        >
          <div>
            <h1 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong w-full max-w-4xl">
              Welcome back, {user?.name?.split(" ")[0] || "Learner"}
            </h1>
            <p className="text-ink-muted text-lg mt-3">Continue learning and reach your goals.</p>
          </div>
          <div className="flex gap-3">
            <span className="inline-flex items-center gap-2 bg-gold-soft text-gold-dark text-xs font-bold px-4 py-2 rounded-full">
              <Fire size={15} weight="fill" /> {streak}-day streak
            </span>
            <span className="inline-flex items-center gap-2 bg-ink-strong text-white text-xs font-bold px-4 py-2 rounded-full">
              <Diamond size={14} weight="fill" /> {xp} XP
            </span>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial="hidden" animate="visible"
          variants={stagger}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16"
        >
          <motion.div variants={fadeUp}><StatCard icon={Book} value={enrolledCourses.length} label="Courses Enrolled" tone="green" /></motion.div>
          <motion.div variants={fadeUp}><StatCard ring={<ProgressRing value={overallCompletion} size={46} showValue={false} />} value={`${overallCompletion}%`} label="Overall Completion" /></motion.div>
          <motion.div variants={fadeUp}><StatCard icon={Clock} value={`${totalHours ? totalHours.toFixed(0) : 0}h`} label="Learning Hours" tone="blue" /></motion.div>
          <motion.div variants={fadeUp}><StatCard icon={Trophy} value={completedCount} label="Certificates" tone="gold" /></motion.div>
        </motion.div>

        {/* Continue Learning */}
        {continueCourse ? (
          <motion.section
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
            variants={fadeUp} transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <h2 className="font-display text-2xl md:text-3xl tracking-tighter font-semibold text-ink-strong mb-8">Continue learning</h2>
            <div className="group grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-0 bg-white border-2 border-line rounded-2xl overflow-hidden hover:border-gold hover:shadow-elevated transition-all duration-300">
              <div className="overflow-hidden min-h-[220px]">
                <CourseThumb course={continueCourse.course} className="!aspect-auto !min-h-[220px] !h-full transition-transform duration-700 ease-out group-hover:scale-[1.02]" />
              </div>
              <div className="p-8 flex flex-col gap-4">
                <span className="text-[0.7rem] font-bold text-gold-dark uppercase tracking-wider">{continueCourse.course.category.replace("-", " ")}</span>
                <h3 className="text-lg font-semibold">{continueCourse.course.title}</h3>
                <p className="text-sm text-ink-muted">
                  {enrollments[continueCourse.course.id]?.lastLesson
                    ? "Pick up where you left off"
                    : "Ready to start your first lesson"}
                </p>
                <ProgressBar value={continueCourse.progress} />
                <Link to={`/learn/${continueCourse.course.id}`} className="btn btn-primary self-start mt-2">
                  <PlayCircle size={15} /> Continue Learning
                </Link>
              </div>
            </div>
          </motion.section>
        ) : (
          <motion.section
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} className="mb-16"
          >
            <EmptyState
              pose="sad"
              title="You haven't enrolled in any courses yet"
              description="Explore our catalog and start learning something new today."
              ctaLabel="Explore Courses"
              ctaTo="/courses"
            />
          </motion.section>
        )}

        {/* Recommended */}
        {recommended.length > 0 && (
          <motion.section
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
          >
            <div className="flex items-end justify-between mb-8">
              <h2 className="text-2xl md:text-3xl tracking-tighter font-medium text-ink-strong">Recommended for you</h2>
              <Link to="/courses" className="inline-flex items-center gap-2 text-gold-dark font-bold text-xs tracking-widest uppercase hover:text-gold transition-colors">
                View all <ArrowRight size={13} weight="bold" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
              {recommended.map((c) => (
                <motion.div key={c.id} variants={fadeUp}>
                  <CourseCard course={c} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </div>
    </main>
  );
}
