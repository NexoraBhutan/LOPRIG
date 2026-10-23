from .models import Certificate


def issue_certificate(enrollment) -> tuple[Certificate, bool]:
    """Issue the certificate for a completed enrollment. Idempotent: one certificate per enrollment."""
    return Certificate.objects.get_or_create(
        enrollment=enrollment,
        defaults={"student_id": enrollment.student_id, "course_id": enrollment.course_id},
    )
