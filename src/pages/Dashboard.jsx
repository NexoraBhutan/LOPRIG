import { Link } from "react-router-dom";
import { FaBook, FaClock, FaAward, FaPlayCircle, FaArrowRight, FaFire, FaGem } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useEnrollment } from "../context/EnrollmentContext";
import CourseThumb from "../components/CourseThumb";
import ProgressBar from "../components/ProgressBar";
import CourseCard from "../components/CourseCard";
import StatCard from "../components/StatCard";
import ProgressRing from "../components/ProgressRing";
import Mascot from "../components/Mascot";
import { courses } from "../data/courses";

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
    <div className="page-enter container dash-page">
      <div className="dash-greeting">
        <div>
          <h1>Welcome back, {user?.name?.split(" ")[0] || "Learner"}</h1>
          <p>Continue learning and reach your goals.</p>
        </div>
        <div className="dash-gamify">
          <span className="nav-stat-pill nav-stat-streak"><FaFire size={16} /> {streak}-day streak</span>
          <span className="nav-stat-pill nav-stat-xp"><FaGem size={15} /> {xp} XP</span>
        </div>
      </div>

      <div className="dash-stats">
        <StatCard icon={FaBook} value={enrolledCourses.length} label="Courses Enrolled" tone="green" />
        <StatCard
          ring={<ProgressRing value={overallCompletion} size={46} showValue={false} />}
          value={`${overallCompletion}%`}
          label="Overall Completion"
        />
        <StatCard icon={FaClock} value={`${totalHours ? totalHours.toFixed(0) : 0}h`} label="Learning Hours" tone="blue" />
        <StatCard icon={FaAward} value={completedCount} label="Certificates" tone="gold" />
      </div>

      {continueCourse ? (
        <section className="dash-section">
          <h2 className="dash-section-title">Continue Learning</h2>
          <div className="continue-card card-plain">
            <CourseThumb course={continueCourse.course} className="continue-thumb" />
            <div className="continue-body">
              <span className="eyebrow continue-eyebrow">{continueCourse.course.category.replace("-", " ")}</span>
              <h3>{continueCourse.course.title}</h3>
              <p className="continue-lesson">
                {enrollments[continueCourse.course.id]?.lastLesson
                  ? "Pick up where you left off"
                  : "Ready to start your first lesson"}
              </p>
              <ProgressBar value={continueCourse.progress} />
              <Link to={`/learn/${continueCourse.course.id}`} className="btn btn-primary continue-cta">
                <FaPlayCircle size={15} /> Continue Learning
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="dash-section">
          <div className="empty-state">
            <Mascot pose="sad" size={100} />
            <h3>You haven't enrolled in any courses yet</h3>
            <p>Explore our catalog and start learning something new today.</p>
            <Link to="/courses" className="btn btn-primary">Explore Courses</Link>
          </div>
        </section>
      )}

      {recommended.length > 0 && (
        <section className="dash-section">
          <div className="section-head">
            <h2 className="dash-section-title">Recommended for you</h2>
            <Link to="/courses" className="btn btn-outline btn-sm">View all <FaArrowRight size={13} /></Link>
          </div>
          <div className="course-grid">
            {recommended.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        </section>
      )}
    </div>
  );
}
