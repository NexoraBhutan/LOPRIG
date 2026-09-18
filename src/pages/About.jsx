import { Link } from "react-router-dom";
import Mascot from "../components/Mascot";

const VALUES = [
  { title: "Our mission", body: "Make high-quality, practical education reachable from anywhere in Bhutan, regardless of where a student lives." },
  { title: "Who we serve", body: "Students preparing for exams, professionals upskilling for their careers, and anyone curious to learn something new." },
  { title: "How we teach", body: "Bite-sized video lessons, hands-on projects, and instructors who understand the Bhutanese context." },
];

export default function About() {
  return (
    <div className="page-enter">
      <section className="about-hero">
        <div className="container about-hero-grid">
          <div>
            <span className="eyebrow">About Lop-rig</span>
            <h1>Skills built for Bhutan's future.</h1>
            <p className="hero-sub" style={{ maxWidth: 560 }}>
              Lop-rig is an online learning platform built for Bhutanese students, professionals, and
              lifelong learners who want practical, affordable, and locally relevant education.
            </p>
          </div>
          <Mascot pose="idle" size={160} className="about-hero-mascot" />
        </div>
      </section>

      <section className="section container about-values-section">
        <div className="about-values">
          {VALUES.map((v, i) => (
            <div className="about-value" key={v.title}>
              <span className="about-value-num">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="about-story card-plain">
          <h2>Built by learners, for learners</h2>
          <p>
            Lop-rig started with a simple idea: education in Bhutan shouldn't be limited by geography.
            Whether you're a student in Thimphu, a teacher in Trashigang, or an entrepreneur in Punakha,
            Lop-rig brings the same quality of learning to your screen — in a format built around Gross
            National Happiness values of balance, community, and sustainable growth.
          </p>
          <span className="about-story-credit">A product by Nexora</span>
        </div>
      </section>

      <section className="section container">
        <div className="cta-banner">
          <h2>Have a question or some feedback?</h2>
          <p>We read every message — reach out and tell us what you'd like to see next.</p>
          <Link to="/signup" className="btn btn-secondary btn-lg">Create an account</Link>
        </div>
      </section>
    </div>
  );
}
