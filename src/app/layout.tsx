import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Outfit, Space_Grotesk } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { CatalogProvider } from "@/context/CatalogContext";
import { EnrollmentProvider } from "@/context/EnrollmentContext";
import { ToastProvider } from "@/context/ToastContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { PasswordSetupGuard, ScrollToTop } from "@/components/RouteUtils";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lop-rig — Learn. Grow. Build Your Future.",
  description:
    "Lop-rig is Bhutan's online learning platform for practical, skills-first courses in programming, business, design, languages, and more.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `data-scroll-behavior="smooth"` opts back into Next's scroll override
    // during route transitions — the project CSS sets `scroll-behavior: smooth`
    // globally, and without this Next 16 would let it animate every navigation.
    <html lang="en" className={`${outfit.variable} ${spaceGrotesk.variable}`} data-scroll-behavior="smooth">
      <body>
        <CatalogProvider>
          <AuthProvider>
            <EnrollmentProvider>
              <ToastProvider>
                <ScrollToTop />
                <PasswordSetupGuard />
                <div className="app-shell">
                  <Navbar />
                  <main>{children}</main>
                  <Footer />
                </div>
              </ToastProvider>
            </EnrollmentProvider>
          </AuthProvider>
        </CatalogProvider>
      </body>
    </html>
  );
}