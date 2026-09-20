import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/home.css";
import "./styles/listing.css";
import "./styles/course-details.css";
import "./styles/auth.css";
import "./styles/dashboard.css";
import "./styles/mylearning.css";
import "./styles/player.css";
import "./styles/checkout.css";
import "./styles/profile.css";
import "./styles/about.css";
import "./styles/awwwards.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext";
import { EnrollmentProvider } from "./context/EnrollmentContext";
import { ToastProvider } from "./context/ToastContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <EnrollmentProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </EnrollmentProvider>
    </AuthProvider>
  </StrictMode>
);
