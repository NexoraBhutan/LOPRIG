from django.contrib import admin
from unfold.admin import ModelAdmin
from unfold.decorators import display

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(ModelAdmin):
    list_display = ["reference", "student", "course", "show_amount", "provider", "show_status", "paid_at", "created_at"]
    list_filter = ["status", "provider"]
    list_filter_submit = True
    search_fields = ["reference", "provider_reference", "student__email", "course__title"]
    raw_id_fields = ["student", "course", "enrollment"]
    # Payment state changes only through verified webhooks, never by hand.
    readonly_fields = [f.name for f in Payment._meta.fields]

    @display(description="Amount", ordering="amount")
    def show_amount(self, obj):
        return f"Nu. {obj.amount:,.0f}"

    @display(
        description="Status",
        label={"Succeeded": "success", "Pending": "warning", "Failed": "danger", "Cancelled": "info"},
    )
    def show_status(self, obj):
        return obj.get_status_display()

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
