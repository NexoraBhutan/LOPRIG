import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Mascot from "../components/Mascot";

export default function NotFound() {
  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-8 bg-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-center"
      >
        <Mascot pose="sad" size={150} className="mx-auto mb-6" />
        <h1 className="text-6xl md:text-8xl font-bold text-ink-strong tracking-tighter mb-4">404</h1>
        <p className="text-lg text-ink-muted mb-8">This page doesn&apos;t exist.</p>
        <Link to="/" className="btn btn-primary btn-lg">
          Back to Home
        </Link>
      </motion.div>
    </main>
  );
}
