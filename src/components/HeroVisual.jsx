import { FaAward, FaPlayCircle, FaFire } from "react-icons/fa";
import Mascot from "./Mascot";

// Mascot-anchored hero composition — replaces the old dark-theme "lesson
// mock" panel. The takin is the character the whole visual identity is
// built around, so the hero puts it front and center instead of an
// abstract illustration.
export default function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <span className="hero-visual-blob" />
      <Mascot pose="celebrate" size={260} className="hero-mascot" />

      <div className="hero-chip hero-chip-1 hero-chip-green">
        <FaAward size={18} />
        <span>Certificate on completion</span>
      </div>
      <div className="hero-chip hero-chip-2 hero-chip-blue">
        <FaPlayCircle size={18} />
        <span>1,200+ video lessons</span>
      </div>
      <div className="hero-chip hero-chip-3 hero-chip-gold">
        <FaFire size={18} />
        <span>Learn at your pace</span>
      </div>
    </div>
  );
}
