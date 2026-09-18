import { Link } from "react-router-dom";
import { FaClock, FaUsers, FaHeart, FaRegHeart, FaChartBar } from "react-icons/fa";
import CourseThumb from "./CourseThumb";
import Rating from "./Rating";
import { useEnrollment } from "../context/EnrollmentContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function CourseCard({ course }) {
  const { toggleSaved, enrollments } = useEnrollment();
  const { user } = useAuth();
  const { push } = useToast();
  const saved = Boolean(enrollments[course.id]?.saved);

  const handleSave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      push("Log in to save courses to your list.", "info");
      return;
    }
    toggleSaved(course.id);
    push(saved ? "Removed from saved courses" : "Saved to your list", "success");
  };

  return (
    <Link to={`/courses/${course.id}`} className="course-card card">
      <div className="course-card-media">
        <CourseThumb course={course} />
        {course.bestseller && <span className="badge badge-bestseller course-card-badge">Bestseller</span>}
        <button
          className={`course-card-save ${saved ? "is-saved" : ""}`}
          onClick={handleSave}
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved courses" : "Save course"}
        >
          {saved ? <FaHeart size={18} /> : <FaRegHeart size={18} />}
        </button>
      </div>
      <div className="course-card-body">
        <span className="course-card-cat">{course.category.replace("-", " ")}</span>
        <h3 className="course-card-title">{course.title}</h3>
        <p className="course-card-instructor">{course.instructor.name}</p>
        <Rating value={course.rating} count={course.students} size={15} />
        <div className="course-card-meta course-card-meta-sub">
          <span><FaClock size={15} /> {course.duration}</span>
          <span><FaChartBar size={15} /> {course.level}</span>
          <span><FaUsers size={15} /> {course.students.toLocaleString()}</span>
        </div>
        <div className="course-card-price">
          <strong>Nu. {course.discountPrice.toLocaleString()}</strong>
          {course.discountPrice < course.price && <span>Nu. {course.price.toLocaleString()}</span>}
        </div>
      </div>
    </Link>
  );
}
