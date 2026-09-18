import { Link, useParams } from "react-router-dom";
import { FaPlayCircle, FaTachometerAlt } from "react-icons/fa";
import { getCourseById } from "../data/courses";
import CourseThumb from "../components/CourseThumb";
import Mascot from "../components/Mascot";

export default function PaymentSuccess() {
  const { id } = useParams();
  const course = getCourseById(id);

  return (
    <div className="page-enter success-page">
      <div className="success-card card-plain">
        <Mascot pose="celebrate" size={140} className="success-mascot" />
        <h1>Payment Successful</h1>
        <p>You're enrolled in this course.</p>

        {course && (
          <div className="success-course card-plain">
            <CourseThumb course={course} className="summary-thumb" />
            <div>
              <h4>{course.title}</h4>
              <p>{course.instructor.name}</p>
            </div>
          </div>
        )}

        <div className="success-actions">
          <Link to={`/learn/${id}`} className="btn btn-primary btn-lg btn-block"><FaPlayCircle size={16} /> Start Learning</Link>
          <Link to="/dashboard" className="btn btn-secondary btn-block"><FaTachometerAlt size={15} /> Go to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
