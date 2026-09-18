import { FaBook } from "react-icons/fa";

// Renders a deterministic gradient "thumbnail" for a course, avoiding
// external image dependencies while keeping every card visually distinct.
export default function CourseThumb({ course, className = "" }) {
  const [c1, c2] = course.gradient || ["#ffb606", "#c88e00"];
  return (
    <div
      className={`course-thumb ${className}`}
      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
      role="img"
      aria-label={`${course.title} thumbnail`}
    >
      <div className="course-thumb-pattern" />
      <FaBook size={36} className="course-thumb-icon" />
      <span className="course-thumb-cat">{course.category.replace("-", " ")}</span>
    </div>
  );
}
