import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FaPhone, FaUniversity, FaCreditCard, FaWallet, FaShieldAlt, FaSpinner } from "react-icons/fa";
import { getCourseById } from "../data/courses";
import { useAuth } from "../context/AuthContext";
import { useEnrollment } from "../context/EnrollmentContext";
import CourseThumb from "../components/CourseThumb";

const METHODS = [
  { id: "mobile", label: "Mobile Banking", desc: "mBoB, BOBiL, DK Bank Mobile (demo)", icon: FaPhone },
  { id: "bank", label: "Bank Transfer", desc: "BOB, BNB, DPNB, T Bank (demo)", icon: FaUniversity },
  { id: "card", label: "Card", desc: "Visa / Mastercard (demo)", icon: FaCreditCard },
  { id: "wallet", label: "Digital Wallet", desc: "MyPay, PayEase (demo)", icon: FaWallet },
];

export default function Checkout() {
  const { id } = useParams();
  const course = getCourseById(id);
  const { user } = useAuth();
  const { enroll } = useEnrollment();
  const navigate = useNavigate();
  const [method, setMethod] = useState("mobile");
  const [processing, setProcessing] = useState(false);

  if (!user) {
    navigate("/login", { state: { from: `/checkout/${id}` } });
    return null;
  }
  if (!course) {
    return (
      <div className="container page-enter" style={{ padding: "100px 0", textAlign: "center" }}>
        <h2>Course not found</h2>
        <Link to="/courses" className="btn btn-primary" style={{ marginTop: 20 }}>Browse courses</Link>
      </div>
    );
  }

  const discount = course.price - course.discountPrice;

  const handlePay = () => {
    setProcessing(true);
    setTimeout(() => {
      enroll(course.id);
      navigate(`/payment-success/${course.id}`);
    }, 1800);
  };

  return (
    <div className="page-enter container checkout-page">
      <h1 className="section-title" style={{ marginBottom: 30 }}>Checkout</h1>

      <div className="checkout-grid">
        <div className="checkout-main">
          <div className="details-block card-plain">
            <h2>Payment method</h2>
            <div className="payment-methods">
              {METHODS.map((m) => {
                const Icon = m.icon;
                return (
                  <label className={`payment-method ${method === m.id ? "selected" : ""}`} key={m.id}>
                    <input type="radio" name="method" checked={method === m.id} onChange={() => setMethod(m.id)} />
                    <span className="payment-method-icon"><Icon size={18} /></span>
                    <span className="payment-method-text">
                      <strong>{m.label}</strong>
                      <span>{m.desc}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="demo-note"><FaShieldAlt size={14} /> This is a simulated payment flow for demo purposes — no real transaction will be made.</p>
          </div>
        </div>

        <div className="checkout-summary card-plain">
          <h2>Order summary</h2>
          <div className="summary-course">
            <CourseThumb course={course} className="summary-thumb" />
            <div>
              <h4>{course.title}</h4>
              <p>{course.instructor.name}</p>
            </div>
          </div>
          <div className="summary-row"><span>Original price</span><span>Nu. {course.price.toLocaleString()}</span></div>
          <div className="summary-row discount"><span>Discount</span><span>- Nu. {discount.toLocaleString()}</span></div>
          <div className="summary-row total"><span>Total</span><span>Nu. {course.discountPrice.toLocaleString()}</span></div>
          <button className="btn btn-primary btn-block btn-lg" onClick={handlePay} disabled={processing}>
            {processing ? (<><FaSpinner size={16} className="spin" /> Processing...</>) : (`Pay Nu. ${course.discountPrice.toLocaleString()}`)}
          </button>
        </div>
      </div>
    </div>
  );
}
