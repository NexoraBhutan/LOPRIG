/** Lop-rig's rules for students and lesson videos. Students accept these before every enrollment. */

/** Shown on the rules page and checked by the backend once watch-time tracking is built. */
export const MIN_WATCH_HOURS = 1;

export const RULES_UPDATED = "15 November 2026";

export interface RuleSection {
  title: string;
  points: string[];
}

export const RULES: RuleSection[] = [
  {
    title: "Watching your lessons",
    points: [
      `Watch a minimum of ${MIN_WATCH_HOURS} hour of lesson videos to keep your learning on track.`,
      "If you stop watching your lessons, your account may be locked. Contact Lop-rig to unlock it.",
      "Learn at your own pace, but keep coming back: progress, quizzes and certificates depend on it.",
    ],
  },
  {
    title: "No recording, no sharing",
    points: [
      "Screen recording, filming or screenshotting lesson videos is not allowed.",
      "Sharing, uploading, selling or sending lesson videos, links or course materials to anyone is not allowed.",
      "Lesson videos belong to Lop-rig and its teachers and are for your own learning only.",
    ],
  },
  {
    title: "Your account is yours alone",
    points: [
      "Your account is for one student. Do not share your password or let others learn on your account.",
      "Keep your login details private. Tell Lop-rig straight away if you think someone else used your account.",
    ],
  },
  {
    title: "Honest learning",
    points: [
      "Answer chapter quizzes and written questions yourself, in your own words.",
      "Certificates are awarded only for your own completed work.",
    ],
  },
  {
    title: "Respect in the community",
    points: [
      "Be kind and respectful in lesson comments and replies, to teachers and other students.",
      "Do not post offensive, misleading or unrelated content.",
    ],
  },
  {
    title: "If the rules are broken",
    points: [
      "Lop-rig may lock your account or remove your access to a course if these rules are broken.",
      "Serious cases, such as recording or sharing videos, may lead to your account being closed.",
    ],
  },
];
