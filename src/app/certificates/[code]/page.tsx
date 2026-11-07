import { Suspense } from "react";
import CertificateView from "@/views/CertificateView";

export const metadata = { title: "Certificate of completion — Lop-rig" };

// Public on purpose: anyone with the link (an employer, a school) can view and verify it.
export default function CertificatePage() {
  return (
    <Suspense>
      <CertificateView />
    </Suspense>
  );
}
