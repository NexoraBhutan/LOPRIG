import { Link } from "react-router-dom";
import { FaExternalLinkAlt } from "react-icons/fa";
import { FacebookGlyph, InstagramGlyph, LinkedinGlyph, YoutubeGlyph } from "./SocialGlyphs";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div className="footer-brand">
          <Logo />
          <p>
            Lop-rig is Bhutan's home for practical, skills-first online learning — built for students,
            professionals, and lifelong learners across the Kingdom.
          </p>
          <div className="footer-social">
            <a href="#" aria-label="Facebook"><FacebookGlyph /></a>
            <a href="#" aria-label="Instagram"><InstagramGlyph /></a>
            <a href="#" aria-label="LinkedIn"><LinkedinGlyph /></a>
            <a href="#" aria-label="YouTube"><YoutubeGlyph /></a>
          </div>
        </div>

        <div className="footer-col">
          <h4>Platform</h4>
          <Link to="/">Home</Link>
          <Link to="/courses">Courses</Link>
          <Link to="/categories">Categories</Link>
          <Link to="/about">About</Link>
        </div>

        <div className="footer-col">
          <h4>Categories</h4>
          <Link to="/categories/programming">Programming</Link>
          <Link to="/categories/data-science">Data Science</Link>
          <Link to="/categories/business">Business</Link>
          <Link to="/categories/design">Design</Link>
        </div>

        <div className="footer-col">
          <h4>Support</h4>
          <Link to="/about">Contact</Link>
          <Link to="/about">FAQ</Link>
          <Link to="/about">Terms</Link>
          <Link to="/about">Privacy Policy</Link>
          <Link to="/about">Help Center</Link>
        </div>
      </div>

      <div className="container footer-bottom">
        <span>© 2026 Lop-rig. All rights reserved.</span>
        <span>Built for learners in Bhutan</span>
        <a
          href="https://nexero-p6zr.onrender.com"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-credit"
        >
          A Nexora product <FaExternalLinkAlt size={12} />
        </a>
      </div>
    </footer>
  );
}
