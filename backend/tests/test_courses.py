from rest_framework.test import APITestCase

from apps.courses.models import Course

from .factories import make_category, make_course


class CatalogueTests(APITestCase):
    def setUp(self):
        self.programming = make_category("programming", "Programming")
        self.design = make_category("design", "Design")
        self.free = make_course("free-python", price="0", rating="4.9", title="Free Python")
        self.paid = make_course("paid-java", price="900", discount="500", level=Course.Level.INTERMEDIATE)
        self.design_course = make_course("ui-basics", price="300", category=self.design, title="UI Basics")
        self.draft = make_course("secret-draft", status=Course.Status.DRAFT)

    def slugs(self, res):
        return [c["id"] for c in res.data["results"]]

    def test_list_is_public_and_hides_unpublished(self):
        res = self.client.get("/api/v1/courses/")
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("secret-draft", self.slugs(res))
        self.assertEqual(res.data["count"], 3)

    def test_unpublished_detail_is_404(self):
        self.assertEqual(self.client.get("/api/v1/courses/secret-draft/").status_code, 404)

    def test_filters(self):
        self.assertEqual(self.slugs(self.client.get("/api/v1/courses/?category=design")), ["ui-basics"])
        self.assertEqual(self.slugs(self.client.get("/api/v1/courses/?price=free")), ["free-python"])
        self.assertEqual(self.slugs(self.client.get("/api/v1/courses/?level=Intermediate")), ["paid-java"])
        self.assertEqual(self.slugs(self.client.get("/api/v1/courses/?search=ui ba")), ["ui-basics"])
        multi = self.slugs(self.client.get("/api/v1/courses/?category=design&category=programming"))
        self.assertEqual(len(multi), 3)

    def test_sort_by_price_uses_discounted_price(self):
        res = self.client.get("/api/v1/courses/?sort=price-asc")
        self.assertEqual(self.slugs(res), ["free-python", "ui-basics", "paid-java"])

    def test_list_shape_matches_frontend(self):
        course = next(c for c in self.client.get("/api/v1/courses/").data["results"] if c["id"] == "paid-java")
        self.assertEqual(course["price"], 900)
        self.assertEqual(course["discount_price"], 500)
        self.assertEqual(course["lessons_count"], 3)
        self.assertEqual(course["duration"], "15m")
        self.assertEqual(course["category"], "programming")
        self.assertEqual(set(course["instructor"]), {"name", "title"})

    def test_detail_outline_never_leaks_lesson_content(self):
        res = self.client.get("/api/v1/courses/paid-java/")
        self.assertEqual(res.status_code, 200)
        lesson = res.data["curriculum"][0]["lessons"][1]
        self.assertNotIn("video_url", lesson)
        self.assertNotIn("body", lesson)
        self.assertEqual(lesson["duration"], "5:00")

    def test_category_counts_only_published(self):
        res = self.client.get("/api/v1/categories/")
        counts = {c["id"]: c["count"] for c in res.data}
        self.assertEqual(counts, {"programming": 2, "design": 1})
