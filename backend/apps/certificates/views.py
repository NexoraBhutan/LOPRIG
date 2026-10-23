from rest_framework import generics
from rest_framework.permissions import AllowAny

from apps.users.permissions import IsStudent

from .models import Certificate
from .serializers import CertificateSerializer, CertificateVerificationSerializer


class CertificateListView(generics.ListAPIView):
    queryset = Certificate.objects.none()  # schema hint; get_queryset() scopes to the user
    permission_classes = [IsStudent]
    serializer_class = CertificateSerializer

    def get_queryset(self):
        return Certificate.objects.filter(student=self.request.user).select_related("course", "student")


class CertificateDetailView(generics.RetrieveAPIView):
    queryset = Certificate.objects.none()  # schema hint; get_queryset() scopes to the user
    permission_classes = [IsStudent]
    serializer_class = CertificateSerializer
    lookup_field = "code"

    def get_queryset(self):
        return Certificate.objects.filter(student=self.request.user).select_related("course", "student")


class CertificateVerifyView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = CertificateVerificationSerializer
    lookup_field = "code"
    queryset = Certificate.objects.select_related("course", "student")
