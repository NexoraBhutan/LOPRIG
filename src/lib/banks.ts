/** Banks that take part in the RMA payment gateway, as students pick them on the payment page. */
export interface Bank {
  id: string;
  name: string;
  /** Logo in /public/banks. Without one, a lettered badge in the bank's colours is shown. */
  logo?: string;
  initials: string;
  color: string;
  accent: string;
}

export const BANKS: Bank[] = [
  // DK Bank's site was unreachable when the logos were collected: drop its logo at /public/banks/dk.png
  // and set `logo` here to replace the lettered badge.
  { id: "dk", name: "DK", initials: "DK", color: "#14284b", accent: "#f7941d" },
  { id: "bob", name: "Bank of Bhutan", logo: "/banks/bob.png", initials: "BoB", color: "#1ba1dd", accent: "#ffffff" },
  { id: "bdbl", name: "Bhutan Development Bank", logo: "/banks/bdbl.png", initials: "BDB", color: "#2e7d32", accent: "#f9a825" },
  { id: "bnb", name: "Bhutan National Bank", logo: "/banks/bnb.png", initials: "BNB", color: "#c62828", accent: "#ffffff" },
  { id: "drukpnb", name: "Druk PNB", logo: "/banks/drukpnb.png", initials: "PNB", color: "#8b2b2b", accent: "#f2b134" },
  { id: "gerab", name: "Gerab Financials Ltd", logo: "/banks/gerab.png", initials: "GF", color: "#6d2f3a", accent: "#ffffff" },
  { id: "tbank", name: "T-Bank", logo: "/banks/tbank.png", initials: "T", color: "#e0a526", accent: "#ffffff" },
];

export const PAYMENT_PURPOSES = [
  "Course fee",
  "Tuition fee",
  "Exam or certification fee",
  "Learning materials",
  "Other",
] as const;

/** Account numbers are digits only; lengths differ by bank, so the bank's own check is the final word. */
export const ACCOUNT_DIGITS = { min: 9, max: 16 };

export function maskAccount(number: string): string {
  return number.length > 4 ? `•••• ${number.slice(-4)}` : number;
}
