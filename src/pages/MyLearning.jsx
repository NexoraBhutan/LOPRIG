import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaPlayCircle, FaBookmark } from "react-icons/fa";
import { useEnrollment } from "../context/EnrollmentContext";
import CourseThumb from "../components/CourseThumb";
import ProgressBar from "../components/ProgressBar";
import ProgressRing from "../components/ProgressRing";
import Mascot from "../components/Mascot";

const TABS = ["All", "In Progress", "Completed", "Saved"];

export default function MyLearning() {
  const { enrollments, enrolledCourses, savedCourses, isEnrolled, getProgress } = useEnrollment();
  const [tab, setTab] = useState("All");

  const items = useMemo(() => {
    const withProgress = enrolledCourses.map((c) => ({ course: c, progress: getProgress(c.id) }));
    if (tab === "In Progress") return withProgress.filter((x) => x.progress < 100);
    if (tab === "Completed") return withProgress.filter((x) => x.progress === 100);
    if (tab === "Saved") return savedCourses.map((c) => ({ course: c, progress: getProgress(c.id) }));
    return withProgress;
  }, [tab, enrolledCourses, savedCourses, getProgress]);

  // The one course most worth resuming — mirrors Dashboard's pick logic
  // (lowest-progress in-progress course, falling back to any enrolled one)
  // so the two pages agree on "what's next".
  const continueCourse = useMemo(() => {
    const inProgress = enrolledCourses
      .map((c) => ({ course: c, progress: getProgress(c.id) }))
      .sort((a, b) => a.progress - b.progress);
    return inProgress.find((c) => c.progress < 100) || inProgress[0];
  }, [enrolledCourses, getProgress]);

  return (
    <div className="page-enter container mylearning-page">
      <div className="listing-head">
        <div>
          <h1 className="section-title">My Learning</h1>
          <p className="section-sub">Track your progress and jump back into your courses.</p>
        </div>
      </div>

      {tab === "All" && continueCourse && (
        <div className="mylearning-continue card-plain">
          <CourseThumb course={continueCourse.course} className="mylearning-continue-thumb" />
          <div className="mylearning-continue-body">
            <div className="mylearning-continue-head">
              <div>
                <span className="eyebrow mylearning-continue-eyebrow">Continue learning</span>
                <h2>{continueCourse.course.title}</h2>
                <p className="mylearning-continue-lesson">
                  {enrollments[continueCourse.course.id]?.lastLesson
                    ? "Pick up where you left off"
                    : "Ready to start your first lesson"}
                </p>
              </div>
              <ProgressRing value={continueCourse.progress} size={64} label={`${continueCourse.progress}% complete`} />
            </div>
            <Link to={`/learn/${continueCourse.course.id}`} className="btn btn-primary mylearning-continue-cta">
              <FaPlayCircle size={15} /> Continue Learning
            </Link>
          </div>
        </div>
      )}

      <div className="tab-row">
        {TABS.map((t) => (
          <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {items.length ? (
        <div className="mylearning-grid">
          {items.map(({ course, progress }) => {
            const enrolled = isEnrolled(course.id);
            return (
              <div className="mylearning-card card-plain" key={course.id}>
                <CourseThumb course={course} />
                <div className="mylearning-body">
                  <h3>{course.title}</h3>
                  {enrolled ? (
                    <>
                      <p className="mylearning-lesson">
                        {enrollments[course.id]?.lastLesson ? "Last watched a lesson" : "Not started yet"}
                      </p>
                      <ProgressBar value={progress} />
                      <Link to={`/learn/${course.id}`} className="btn btn-primary btn-block mylearning-cta">
                        <FaPlayCircle size={14} /> {progress > 0 ? "Continue" : "Start"} Learning
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="mylearning-lesson mylearning-saved-note">
                        <FaBookmark size={12} /> Saved &middot; not enrolled yet
                      </p>
                      <Link to={`/courses/${course.id}`} className="btn btn-outline btn-block mylearning-cta">
                        View Course
                      </Link>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <Mascot pose="sad" size={100} />
          <h3>Nothing here yet</h3>
          <p>Courses you enroll in or save will show up in this tab.</p>
          <Link to="/courses" className="btn btn-primary">Browse Courses</Link>
        </div>
      )}
    </div>
  );
}
