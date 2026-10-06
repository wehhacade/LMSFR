"""
Management command to create a default admin user for development.

Usage:
    python manage.py seed_admin
    python manage.py seed_admin --email admin@lmsbr.local --password admin12345
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Create or update the default admin user."

    def add_arguments(self, parser):
        parser.add_argument("--email", default="admin@lmsbr.local")
        parser.add_argument("--password", default="admin12345")
        parser.add_argument("--username", default="admin")

    def handle(self, *args, **options):
        email = options["email"]
        password = options["password"]
        username = options["username"]

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": username,
                "is_staff": True,
                "is_superuser": True,
                "is_admin": True,
                "phone": "",
            },
        )
        user.set_password(password)
        user.is_staff = True
        user.is_superuser = True
        user.is_admin = True
        user.is_active = True
        user.suspend = False
        user.save()

        action = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{action} admin user: {email}"))
