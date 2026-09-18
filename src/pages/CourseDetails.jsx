import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  FaClock, FaUsers, FaChartBar, FaGlobe, FaCheckCircle, FaPlayCircle, FaDownload, FaInfinity,
  FaAward, FaChevronDown, FaHeart, FaRegHeart, FaStar,
} from "react-icons/fa";
import CourseThumb from "../components/CourseThumb";
import Rating from "../components/Rating";
import CourseCard from "../components/CourseCard";
import { getCourseById, courses } from "../data/courses";
import { useEnrollment } from "../context/EnrollmentContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

// A plausible 5-star review breakdown for a given average rating — not real
// survey data, but a deterministic geometric decay (no Math.random) so a
// course's bars stay the same on every render instead of reshuffling.
function ratingBreakdown(rating) {
  const clamped = Math.min(5, Math.max(1, rating));
  const decay = 0.35 + (5 - clamped) * 0.25; // steeper drop-off the higher the rating
  const weights = [1, decay, decay ** 2, decay ** 3, decay ** 4]; // 5,4,3,2,1-star
  const total = weights.reduce((s, w) => s + w, 0);
  return weights.map((w) => Math.round((w / total) * 100));
}

export default function CourseDetails() {
  const { id } = useParams();
  const course = getCourseById(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isEnrolled, toggleSaved, enrollments } = useEnrollment();
  const { push } = useToast();
  const [openSections, setOpenSections] = useState({ s1: true });

  const related = useMemo(
    () => courses.filter((c) => c.category === course?.category && c.id !== course?.id).slice(0, 4),
    [course]
  );

  if (!course) {
    return (
      <div className="container page-enter" style={{ padding: "100px 0", textAlign: "center" }}>
        <h2>Course not found</h2>
        <Link to="/courses" className="btn btn-primary" style={{ marginTop: 20 }}>Browse courses</Link>
      </div>
    );
  }

  const enrolled = isEnrolled(course.id);
  const saved = Boolean(enrollments[course.id]?.saved);
  const totalLessons = course.curriculum.reduce((s, sec) => s + sec.lessons.length, 0);

  const handleEnroll = () => {
    if (!user) {
      push("Please log in to enroll in this course.", "info");
      navigate("/login", { state: { from: `/courses/${course.id}` } });
      return;
    }
    if (enrolled) {
      navigate(`/learn/${course.id}`);
      return;
    }
    navigate(`/checkout/${course.id}`);
  };

  const handleSave = () => {
    if (!user) {
      push("Log in to save courses to your list.", "info");
      return;
    }
    toggleSaved(course.id);
    push(saved ? "Removed from saved courses" : "Saved to your list", "success");
  };

  return (
    <div className="page-enter">
      <section className="course-hero">
        <div className="container course-hero-grid">
          <div className="course-hero-info">
            <span className="eyebrow">{course.category.replace("-", " ")} &middot; {course.level}</span>
            <h1>{course.title}</h1>
            <p className="course-hero-desc">{course.description}</p>
            <div className="course-hero-meta">
              <Rating value={course.rating} count={course.students} />
              <span><FaUsers size={14} /> {course.students.toLocaleString()} students</span>
              <span><FaClock size={14} /> {course.duration}</span>
              <span><FaChartBar size={14} /> {course.level}</span>
              <span><FaGlobe size={14} /> {course.language}</span>
            </div>
            <p className="course-hero-instructor">Created by <strong>{course.instructor.name}</strong> — {course.instructor.title}</p>
          </div>

          <div className="course-buy-card card-plain">
            <CourseThumb course={course} className="course-buy-thumb" />
            <div className="course-buy-body">
              <div className="course-buy-price">
                <strong>Nu. {course.discountPrice.toLocaleString()}</strong>
                {course.discountPrice < course.price && (
                  <>
                    <span className="strike">Nu. {course.price.toLocaleString()}</span>
                    <span className="badge badge-new">
                      {Math.round((1 - course.discountPrice / course.price) * 100)}% off
                    </span>
                  </>
                )}
              </div>

              {enrolled ? (
                <Link to={`/learn/${course.id}`} className="btn btn-primary btn-block btn-lg">
                  <FaPlayCircle size={17} /> Go to Course
                </Link>
              ) : (
                <>
                  <button className="btn btn-primary btn-block btn-lg" onClick={handleEnroll}>Enroll Now</button>
                  <button className="btn btn-secondary btn-block" onClick={handleEnroll} style={{ marginTop: 10 }}>Buy Now</button>
                </>
              )}
              <button className="save-link" onClick={handleSave}>
                {saved ? <FaHeart size={14} /> : <FaRegHeart size={14} />} {saved ? "Saved" : "Save for later"}
              </button>

              <ul className="course-includes">
                <li><FaPlayCircle size={15} /> {course.duration} on-demand video</li>
                <li><FaCheckCircle size={15} /> {totalLessons} lessons</li>
                <li><FaDownload size={15} /> Downloadable resources</li>
                <li><FaAward size={15} /> Certificate of completion</li>
                <li><FaInfinity size={15} /> Lifetime access</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="container course-details-body">
        <div className="course-details-main">
          <div className="details-block card-plain">
            <h2>What you'll learn</h2>
            <ul className="learn-grid">
              {course.whatYouLearn.map((item) => (
                <li key={item}><FaCheckCircle size={16} /> {item}</li>
              ))}
            </ul>
          </div>

          <div className="details-block card-plain">
            <h2>Course curriculum</h2>
            <p className="curriculum-meta">{course.curriculum.length} sections &middot; {totalLessons} lessons &middot; {course.duration} total</p>
            <div className="curriculum-list">
              {course.curriculum.map((section) => (
                <div className="curriculum-section" key={section.id}>
                  <button
                    className="curriculum-section-head"
                    onClick={() => setOpenSections((s) => ({ ...s, [section.id]: !s[section.id] }))}
                  >
                    <span>{section.title}</span>
                    <span className="curriculum-section-right">
                      {section.lessons.length} lessons
                      <FaChevronDown size={14} className={openSections[section.id] ? "rotated" : ""} />
                    </span>
                  </button>
                  {openSections[section.id] && (
                    <ul>
                      {section.lessons.map((l) => (
                        <li key={l.id}><FaPlayCircle size={13} /> {l.title} <span>{l.duration}</span></li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="details-block card-plain">
            <h2>Requirements</h2>
            <ul className="req-list">
              {course.requirements.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>

          <div className="details-block card-plain">
            <h2>Description</h2>
            <p className="course-full-desc">{course.description}</p>
          </div>

          <div className="details-block card-plain">
            <h2>Who this course is for</h2>
            <p className="course-full-desc">
              Students, working professionals, and lifelong learners in Bhutan who want practical,
              job-ready {course.category.replace("-", " ")} skills — no matter their starting point.
            </p>
          </div>

          <div className="details-block card-plain">
            <h2>Student reviews</h2>
            <div className="reviews-summary">
              <div className="reviews-score">
                <strong>{course.rating.toFixed(1)}</strong>
                <span className="reviews-score-stars" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <FaStar
                      key={i}
                      size={15}
                      color={i < Math.round(course.rating) ? "var(--gold)" : "var(--line-strong)"}
                    />
                  ))}
                </span>
                <span>Course rating</span>
              </div>
              <div className="reviews-breakdown">
                {ratingBreakdown(course.rating).map((pct, i) => (
                  <div className="rating-bar-row" key={5 - i}>
                    <span className="rating-bar-label">{5 - i} <FaStar size={11} color="var(--gold)" /></span>
                    <div className="rating-bar-track"><div className="rating-bar-fill" style={{ width: `${pct}%` }} /></div>
                    <span className="rating-bar-pct">{pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <ReviewSample name="Sonam Choki" text="Very clear explanations and practical exercises. Helped me a lot with my studies." rating={5} color="var(--ink-strong)" />
            <ReviewSample name="Pema Tobgay" text="Good pacing and the instructor explains concepts step by step." rating={4.5} color="var(--gold-dark)" />
          </div>
        </div>

        <aside className="course-details-side" />
      </section>

      {related.length > 0 && (
        <section className="section container">
          <div className="section-head"><h2 className="section-title">Related Courses</h2></div>
          <div className="course-grid">
            {related.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function ReviewSample({ name, text, rating, color }) {
  return (
    <div className="review-item">
      <span className="avatar" style={{ background: color }}>{name.charAt(0)}</span>
      <div>
        <div className="review-item-head">
          <strong>{name}</strong>
          <Rating value={rating} showCount={false} size={12} />
        </div>
        <p>{text}</p>
      </div>
    </div>
  );
}
