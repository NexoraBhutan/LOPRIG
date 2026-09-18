import { useEffect, useState, useRef } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { FaSearch, FaBell, FaBars, FaTimes, FaChevronDown, FaTachometerAlt, FaGraduationCap, FaUser, FaSignOutAlt, FaFire, FaGem } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useEnrollment } from "../context/EnrollmentContext";
import Logo from "./Logo";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/courses", label: "Courses" },
  { to: "/categories", label: "Categories" },
  { to: "/about", label: "About" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { streak, xp } = useEnrollment();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const profileRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    setSearchOpen(false);
    setQuery("");
  };

  return (
    <header className={`navbar ${scrolled ? "navbar-scrolled" : ""}`}>
      <div className="container navbar-inner">
        <Link to="/" className="navbar-logo" onClick={() => setMenuOpen(false)}>
          <Logo />
        </Link>

        <nav className="navbar-links" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`} end={link.to === "/"}>
              {link.label}
            </NavLink>
          ))}
          {user && (
            <NavLink to="/my-learning" className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`}>
              My Learning
            </NavLink>
          )}
        </nav>

        <div className="navbar-actions">
          <button className="icon-btn" aria-label="Search courses" onClick={() => setSearchOpen((s) => !s)}>
            <FaSearch size={16} />
          </button>

          {user ? (
            <>
              <div className="nav-gamify" aria-label="Learning streak and XP">
                <span className="nav-stat-pill nav-stat-streak" title={`${streak}-day streak`}>
                  <FaFire size={16} /> {streak}
                </span>
                <span className="nav-stat-pill nav-stat-xp" title={`${xp} XP earned`}>
                  <FaGem size={15} /> {xp}
                </span>
              </div>
              <button className="icon-btn" aria-label="Notifications">
                <FaBell size={16} />
                <span className="icon-dot" />
              </button>
              <div className="navbar-profile" ref={profileRef}>
                <button className="profile-trigger" onClick={() => setProfileOpen((o) => !o)} aria-expanded={profileOpen}>
                  <span className="avatar" style={{ background: user.avatarColor }}>{user.name.charAt(0).toUpperCase()}</span>
                  <span className="profile-name">{user.name.split(" ")[0]}</span>
                  <FaChevronDown size={13} />
                </button>
                {profileOpen && (
                  <div className="profile-dropdown glass">
                    <Link to="/dashboard" onClick={() => setProfileOpen(false)}><FaTachometerAlt size={15} /> Dashboard</Link>
                    <Link to="/my-learning" onClick={() => setProfileOpen(false)}><FaGraduationCap size={15} /> My Learning</Link>
                    <Link to="/profile" onClick={() => setProfileOpen(false)}><FaUser size={15} /> Profile</Link>
                    <button onClick={() => { logout(); setProfileOpen(false); navigate("/"); }}><FaSignOutAlt size={15} /> Log out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="navbar-auth">
              <Link to="/login" className="btn btn-outline btn-sm">Log In</Link>
              <Link to="/signup" className="btn btn-primary btn-sm">Sign Up</Link>
            </div>
          )}

          <button className="icon-btn hamburger" aria-label="Toggle menu" onClick={() => setMenuOpen((m) => !m)}>
            {menuOpen ? <FaTimes size={18} /> : <FaBars size={18} />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="navbar-search-panel container">
          <form onSubmit={submitSearch} className="navbar-search-form">
            <FaSearch size={16} />
            <input
              autoFocus
              type="text"
              placeholder="Search for courses, skills, or topics..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">Search</button>
          </form>
        </div>
      )}

      <div className={`mobile-menu ${menuOpen ? "open" : ""}`}>
        <nav>
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className={({ isActive }) => `mobile-nav-link ${isActive ? "active" : ""}`} end={link.to === "/"}>
              {link.label}
            </NavLink>
          ))}
          {user ? (
            <>
              <NavLink to="/my-learning" onClick={() => setMenuOpen(false)} className={({ isActive }) => `mobile-nav-link ${isActive ? "active" : ""}`}>My Learning</NavLink>
              <NavLink to="/dashboard" onClick={() => setMenuOpen(false)} className={({ isActive }) => `mobile-nav-link ${isActive ? "active" : ""}`}>Dashboard</NavLink>
              <NavLink to="/profile" onClick={() => setMenuOpen(false)} className={({ isActive }) => `mobile-nav-link ${isActive ? "active" : ""}`}>Profile</NavLink>
              <button className="btn btn-outline btn-block" onClick={() => { logout(); setMenuOpen(false); navigate("/"); }}>Log out</button>
            </>
          ) : (
            <div className="mobile-auth">
              <Link to="/login" className="btn btn-outline btn-block" onClick={() => setMenuOpen(false)}>Log In</Link>
              <Link to="/signup" className="btn btn-primary btn-block" onClick={() => setMenuOpen(false)}>Sign Up</Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
