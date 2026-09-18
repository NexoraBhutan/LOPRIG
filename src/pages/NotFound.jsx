import { Link } from "react-router-dom";
import Mascot from "../components/Mascot";

export default function NotFound() {
  return (
    <div className="container page-enter notfound-page">
      <Mascot pose="sad" size={150} />
      <h1>404</h1>
      <p>This page doesn't exist.</p>
      <Link to="/" className="btn btn-primary">Back to Home</Link>
    </div>
  );
}
