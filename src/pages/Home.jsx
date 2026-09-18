import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaArrowRight, FaCode, FaChartBar, FaCalculator, FaBriefcase, FaPalette, FaBullhorn,
  FaShieldAlt, FaGlobe, FaLanguage, FaRocket, FaSearch, FaUserPlus, FaPlayCircle,
  FaPlus, FaMinus, FaExternalLinkAlt,
} from "react-icons/fa";
import HeroVisual from "../components/HeroVisual";
import CourseCard from "../components/CourseCard";
import Mascot from "../components/Mascot";
import { courses, categories, testimonials, learningPaths, getCourseById } from "../data/courses";

const ICONS = {
  Code: FaCode, ChartBar: FaChartBar, Calculator: FaCalculator, Briefcase: FaBriefcase, Palette: FaPalette,
  Bullhorn: FaBullhorn, ShieldAlt: FaShieldAlt, Globe: FaGlobe, Language: FaLanguage, Rocket: FaRocket,
};
const AVATAR_COLORS = ["#c88e00", "#1a1a1a", "#db5246", "#3a3a3a"];

const FAQS = [
  { q: "Do I need any prior experience to start a course?", a: "No. Most Lop-rig courses are designed for absolute beginners, and each course page clearly lists any requirements before you enroll." },
  { q: "Can I access courses on my phone?", a: "Yes. Lop-rig works on desktop, tablet, and mobile, so you can learn from anywhere in Bhutan with an internet connection." },
  { q: "What payment methods are supported?", a: "You can pay using Mobile Banking, Bank Transfer, Card, or a Digital Wallet during checkout. All payment flows shown are for demo purposes." },
  { q: "Do I get a certificate after finishing a course?", a: "Yes, every course includes a certificate of completion once you finish 100% of the lessons." },
  { q: "Can I learn at my own pace?", a: "Absolutely. Courses are self-paced with lifetime access, so you can pause and resume anytime." },
];

export default function Home() {
  const popular = courses.filter((c) => c.bestseller).slice(0, 8);
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="page-enter">
      {/* HERO */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Learning platform for Bhutan</span>
            <h1>Learn. Grow.<br />Build Your<br />Future.</h1>
            <p className="hero-sub">
              Learn practical skills from anywhere in Bhutan with courses designed for students,
              professionals, and lifelong learners.
            </p>
            <div className="hero-cta">
              <Link to="/courses" className="btn btn-primary btn-lg">Explore Courses <FaArrowRight size={15} /></Link>
              <Link to="/signup" className="btn btn-secondary btn-lg">Start Learning</Link>
            </div>
            <div className="hero-stats">
              <div><strong>14+</strong><span>Categories</span></div>
              <div><strong>12k+</strong><span>Students</span></div>
              <div><strong>4.8</strong><span>Avg. rating</span></div>
            </div>
            <a
              href="https://nexero-p6zr.onrender.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hero-credit"
            >
              Built by Nexora <FaExternalLinkAlt size={12} />
            </a>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* POPULAR COURSES */}
      <section className="section container">
        <div className="section-head">
          <div>
            <span className="eyebrow">Handpicked for you</span>
            <h2 className="section-title">Popular Courses</h2>
          </div>
          <Link to="/courses" className="btn btn-outline">View all courses <FaArrowRight size={14} /></Link>
        </div>
        <div className="course-grid">
          {popular.map((c) => <CourseCard key={c.id} course={c} />)}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="section container">
        <div className="section-head">
          <div>
            <span className="eyebrow">Find your path</span>
            <h2 className="section-title">Browse Categories</h2>
            <p className="section-sub">From programming to Dzongkha, explore skills built for where Bhutan is headed.</p>
          </div>
        </div>
        <div className="category-grid">
          {categories.map((cat) => {
            const Icon = ICONS[cat.icon];
            return (
              <Link to={`/categories/${cat.id}`} key={cat.id} className="category-card card">
                <span className="category-icon"><Icon size={20} /></span>
                <div>
                  <h3>{cat.title}</h3>
                  <span>{cat.count} courses</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* WHY LEARN WITH US */}
      <section className="section why-section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Why Lop-rig</span>
              <h2 className="section-title">Why Learn With Us?</h2>
            </div>
          </div>
          <div className="why-grid">
            <div className="why-card card-plain">
              <span className="why-icon"><FaShieldAlt size={22} /></span>
              <h3>Built for Bhutan</h3>
              <p>Courses shaped around local context, language needs, and career paths relevant to Bhutanese learners.</p>
            </div>
            <div className="why-card card-plain">
              <span className="why-icon"><FaPlayCircle size={22} /></span>
              <h3>Learn by doing</h3>
              <p>Practical, project-based lessons instead of long theory — build real skills you can use right away.</p>
            </div>
            <div className="why-card card-plain">
              <span className="why-icon"><FaRocket size={22} /></span>
              <h3>Learn at your pace</h3>
              <p>Lifetime access to every course you enroll in, so you can pause, resume, and revisit anytime.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section container">
        <div className="section-head">
          <div>
            <span className="eyebrow">Getting started</span>
            <h2 className="section-title">How It Works</h2>
          </div>
        </div>
        <div className="steps-grid">
          <div className="step-card card-plain">
            <span className="step-icon"><FaUserPlus size={18} /></span>
            <h3>Create your account</h3>
            <p>Sign up in seconds and set up your learner profile.</p>
          </div>
          <div className="step-card card-plain">
            <span className="step-icon"><FaSearch size={18} /></span>
            <h3>Find a course</h3>
            <p>Search or browse categories to find the right skill for you.</p>
          </div>
          <div className="step-card card-plain">
            <span className="step-icon"><FaArrowRight size={18} /></span>
            <h3>Enroll & pay</h3>
            <p>Enroll in minutes with a simple, secure checkout flow.</p>
          </div>
          <div className="step-card card-plain">
            <span className="step-icon"><FaPlayCircle size={18} /></span>
            <h3>Start learning</h3>
            <p>Watch lessons, track progress, and earn your certificate.</p>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section testimonials-section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Student success</span>
              <h2 className="section-title">Loved by learners across Bhutan</h2>
            </div>
          </div>
          <div className="testimonials-grid">
            {testimonials.map((t, i) => (
              <div className="testimonial-card card-plain" key={t.name}>
                <p>"{t.quote}"</p>
                <div className="testimonial-author">
                  <span className="avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>{t.name.charAt(0)}</span>
                  <div>
                    <strong>{t.name}</strong>
                    <span>{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LEARNING PATHS */}
      <section className="section container">
        <div className="section-head">
          <div>
            <span className="eyebrow">Structured journeys</span>
            <h2 className="section-title">Featured Learning Paths</h2>
            <p className="section-sub">Follow a curated sequence of courses to build a complete skill set.</p>
          </div>
        </div>
        <div className="paths-grid">
          {learningPaths.map((path) => (
            <div className="path-card card-plain" key={path.id} style={{ "--path-color": path.color }}>
              <h3>{path.title}</h3>
              <ul className="path-list">
                {path.courseIds.map((id, i) => {
                  const c = getCourseById(id);
                  return <li key={id}><span>{i + 1}</span>{c?.title}</li>;
                })}
              </ul>
              <Link to={`/courses/${path.courseIds[0]}`} className="btn btn-outline btn-sm">Start this path</Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="section container faq-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Questions</span>
            <h2 className="section-title">Frequently Asked Questions</h2>
          </div>
        </div>
        <div className="faq-list">
          {FAQS.map((f, i) => (
            <div className={`faq-item ${openFaq === i ? "open" : ""}`} key={f.q}>
              <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? -1 : i)} aria-expanded={openFaq === i}>
                {f.q}
                {openFaq === i ? <FaMinus size={15} /> : <FaPlus size={15} />}
              </button>
              <div className="faq-answer"><p>{f.a}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section container">
        <div className="cta-banner">
          <Mascot pose="celebrate" size={72} className="cta-banner-mascot" />
          <div className="cta-banner-copy">
            <h2>Pick a course. Start today.</h2>
            <p>Free to sign up — pay only when you enroll in a course.</p>
            <Link to="/signup" className="btn btn-secondary btn-lg">Create your free account</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
