// Marketing content for the home page.
// Courses and categories come from the API (see CatalogContext); the original
// demo catalogue now lives in backend/apps/courses/fixtures/demo_catalog.json.

import type { LearningPath, Testimonial } from "@/types";

export const testimonials: Testimonial[] = [
  {
    name: "Sangay Bidha",
    role: "Student, Thimphu",
    quote:
      "Lop-rig helped me learn web development while finishing school. The lessons fit around my schedule and the certificate helped me land an internship.",
  },
  {
    name: "Tashi Namgyel",
    role: "Civil Servant, Paro",
    quote:
      "I picked up data analysis skills for my job in just two months. The instructors explain things in a way that actually makes sense.",
  },
  {
    name: "Deki Yangzom",
    role: "Aspiring Entrepreneur, Punakha",
    quote:
      "The entrepreneurship course gave me the confidence and framework to start my own small business here in Bhutan.",
  },
];

export const learningPaths: LearningPath[] = [
  { id: "path-swe", title: "Software Developer Path", courseIds: ["py-beginners", "web-dev-complete", "java-oop"], color: "#ffb606" },
  { id: "path-data", title: "Data & Analytics Path", courseIds: ["py-beginners", "data-science-python", "applied-mathematics"], color: "#1a1a1a" },
  { id: "path-biz", title: "Business & Startup Path", courseIds: ["business-fundamentals", "accounting-essentials", "entrepreneurship-startup"], color: "#ff6347" },
];
