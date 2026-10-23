import django_filters
from django.db.models import Q

from .models import Category, Course

ORDERINGS = {
    "popular": ["-students_count", "-rating"],
    "rating": ["-rating", "-students_count"],
    "newest": ["-published_at"],
    "price-asc": ["effective_price", "title"],
    "price-desc": ["-effective_price", "title"],
}


class CourseFilter(django_filters.FilterSet):
    """Mirrors the frontend's Filters + SortOption types."""

    category = django_filters.ModelMultipleChoiceFilter(
        field_name="category__slug", to_field_name="slug", queryset=Category.objects.all()
    )
    level = django_filters.MultipleChoiceFilter(choices=Course.Level.choices)
    price = django_filters.ChoiceFilter(choices=[("free", "Free"), ("paid", "Paid")], method="filter_price")
    min_rating = django_filters.NumberFilter(field_name="rating", lookup_expr="gte")
    search = django_filters.CharFilter(method="filter_search")
    sort = django_filters.ChoiceFilter(choices=[(k, k) for k in ORDERINGS], method="filter_sort")

    class Meta:
        model = Course
        fields = []

    def filter_price(self, queryset, name, value):
        return queryset.filter(effective_price=0) if value == "free" else queryset.filter(effective_price__gt=0)

    def filter_search(self, queryset, name, value):
        value = value.strip()
        if not value:
            return queryset
        return queryset.filter(
            Q(title__icontains=value)
            | Q(description__icontains=value)
            | Q(teacher__name__icontains=value)
            | Q(category__title__icontains=value)
        )

    def filter_sort(self, queryset, name, value):
        return queryset.order_by(*ORDERINGS[value])
