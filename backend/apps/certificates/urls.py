from django.urls import path

from .views import CertificateDetailView, CertificateListView, CertificateVerifyView

urlpatterns = [
    path("", CertificateListView.as_view(), name="certificate-list"),
    path("verify/<str:code>/", CertificateVerifyView.as_view(), name="certificate-verify"),
    path("<str:code>/", CertificateDetailView.as_view(), name="certificate-detail"),
]
