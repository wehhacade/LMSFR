from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.mobile.models import AppVersionPolicy, AppVersionRelease

LOC_MEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


@override_settings(CACHES=LOC_MEM)
class AppVersionGateTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.policy = AppVersionPolicy.objects.get(pk=1)
        self.user = User.objects.create_user(
            username="version-agent",
            email="version-agent@lmsbr.local",
            password="test-pass",
            is_active=True,
        )

    def _raise_minimum(self, code: int):
        self.policy.min_version_code = code
        self.policy.save()
        cache.clear()

    def test_public_payload_needs_no_login(self):
        response = self.client.get("/api/v3/app-version")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            set(response.data),
            {"min_version_code", "latest_version_code", "apk_url", "message"},
        )
        self.assertEqual(response.data["min_version_code"], 3)
        self.assertEqual(response.data["latest_version_code"], 3)
        self.assertEqual(response.data["apk_url"], "https://lmsbr.com/app/ilaalo.apk")
        self.assertEqual(response.data["message"], "Cusbooneysii app-ka")

    def test_old_app_can_read_version_while_blocked_everywhere_else(self):
        self._raise_minimum(3)
        public = self.client.get("/api/v3/app-version", HTTP_X_APP_VERSION_CODE="1")
        self.assertEqual(public.status_code, 200)
        blocked = self.client.post(
            "/api/v3/login/",
            {"email": self.user.email, "password": "test-pass"},
            format="json",
            HTTP_X_APP_VERSION_CODE="1",
        )
        self.assertEqual(blocked.status_code, 426)
        self.assertEqual(blocked.json()["apk_url"], "https://lmsbr.com/app/ilaalo.apk")
        self.assertEqual(blocked.json()["message"], "Cusbooneysii app-ka")

    def test_token_does_not_bypass_minimum(self):
        self._raise_minimum(3)
        response = self.client.get(
            "/api/v3/user-profile/",
            HTTP_AUTHORIZATION="Bearer not-a-real-token",
            HTTP_X_APP_VERSION_CODE="2",
        )
        self.assertEqual(response.status_code, 426)

    def test_verified_build_reaches_login(self):
        self._raise_minimum(3)
        response = self.client.post(
            "/api/v3/login/",
            {"email": self.user.email, "password": "wrong-pass"},
            format="json",
            HTTP_X_APP_VERSION_CODE="3",
        )
        self.assertNotEqual(response.status_code, 426)

    def test_installed_version_is_refused_on_deploy(self):
        blocked = self.client.post(
            "/api/v3/login/",
            {"email": self.user.email, "password": "test-pass"},
            format="json",
            HTTP_X_APP_VERSION_CODE="2",
        )
        self.assertEqual(blocked.status_code, 426)

    def test_missing_header_counts_as_zero(self):
        blocked = self.client.post(
            "/api/v3/login/",
            {"email": self.user.email, "password": "test-pass"},
            format="json",
        )
        self.assertEqual(blocked.status_code, 426)

        self._raise_minimum(0)
        allowed = self.client.post(
            "/api/v3/login/",
            {"email": self.user.email, "password": "wrong-pass"},
            format="json",
        )
        self.assertNotEqual(allowed.status_code, 426)

    def test_website_is_not_the_phone_gate(self):
        self._raise_minimum(3)
        response = self.client.post(
            "/api/v3/login/",
            {"email": self.user.email, "password": "wrong-pass"},
            format="json",
            HTTP_X_LMSBR_CLIENT="web",
        )
        self.assertNotEqual(response.status_code, 426)

    def test_admin_can_update_release_from_the_dashboard(self):
        admin = User.objects.create_superuser(
            username="version-admin",
            email="version-admin@lmsbr.local",
            password="test-pass",
        )
        self.client.force_authenticate(user=admin)
        response = self.client.patch(
            "/api/v3/app-version",
            {
                "min_version_code": 4,
                "latest_version_code": 4,
                "apk_url": "https://lmsbr.com/app/ilaalo.apk",
                "message": "Cusbooneysii",
            },
            format="json",
            HTTP_X_LMSBR_CLIENT="web",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["min_version_code"], 4)
        cache.clear()
        public = self.client.get("/api/v3/app-version")
        self.assertEqual(public.data["min_version_code"], 4)

    def test_dashboard_lists_every_saved_release(self):
        admin = User.objects.create_superuser(
            username="version-history",
            email="version-history@lmsbr.local",
            password="test-pass",
        )
        self.client.force_authenticate(user=admin)
        before = self.client.get("/api/v3/app-releases", HTTP_X_LMSBR_CLIENT="web")
        self.assertEqual(before.status_code, 200, before.content)
        self.assertGreaterEqual(len(before.data["releases"]), 1)
        saved = self.client.patch(
            "/api/v3/app-version",
            {
                "min_version_code": 4,
                "latest_version_code": 5,
                "apk_url": "https://lmsbr.com/app/ilaalo.apk",
                "message": "Nooc cusub",
            },
            format="json",
            HTTP_X_LMSBR_CLIENT="web",
        )
        self.assertEqual(saved.status_code, 200, saved.content)
        public = self.client.get("/api/v3/app-version")
        self.assertEqual(
            set(public.data.keys()),
            {"min_version_code", "latest_version_code", "apk_url", "message"},
        )
        after = self.client.get("/api/v3/app-releases", HTTP_X_LMSBR_CLIENT="web")
        self.assertEqual(after.data["releases"][0]["version_code"], 5)
        self.assertEqual(after.data["releases"][0]["message"], "Nooc cusub")
        self.assertGreater(len(after.data["releases"]), len(before.data["releases"]))

    def test_major_and_minor_keep_the_public_shape(self):
        admin = User.objects.create_superuser(
            username="version-parts",
            email="version-parts@lmsbr.local",
            password="test-pass",
        )
        self.client.force_authenticate(user=admin)
        saved = self.client.patch(
            "/api/v3/app-version",
            {
                "min_major": 3,
                "min_minor": 0,
                "min_patch": 0,
                "latest_major": 3,
                "latest_minor": 1,
                "latest_patch": 2,
                "apk_url": "https://lmsbr.com/app/ilaalo.apk",
                "message": "Cusbooneysii app-ka",
            },
            format="json",
            HTTP_X_LMSBR_CLIENT="web",
        )
        self.assertEqual(saved.status_code, 200, saved.content)
        self.assertEqual(saved.data["latest_major"], 3)
        self.assertEqual(saved.data["latest_minor"], 1)
        self.assertEqual(saved.data["latest_patch"], 2)
        self.assertEqual(saved.data["latest_version_code"], 30102)
        self.assertEqual(saved.data["min_version_code"], 3)
        public = self.client.get("/api/v3/app-version")
        self.assertEqual(
            set(public.data.keys()),
            {"min_version_code", "latest_version_code", "apk_url", "message"},
        )
        self.assertEqual(public.data["latest_version_code"], 30102)
        listed = self.client.get("/api/v3/app-releases", HTTP_X_LMSBR_CLIENT="web")
        self.assertEqual(listed.data["current"]["latest_patch"], 2)
        self.assertEqual(listed.data["releases"][0]["version_major"], 3)
        self.assertEqual(listed.data["releases"][0]["version_minor"], 1)
        self.assertEqual(listed.data["releases"][0]["version_patch"], 2)

    def test_admin_can_lower_the_version(self):
        admin = User.objects.create_superuser(
            username="version-lower",
            email="version-lower@lmsbr.local",
            password="test-pass",
        )
        self.client.force_authenticate(user=admin)
        raised = self.client.patch(
            "/api/v3/app-version",
            {"latest_major": 3, "latest_minor": 1, "latest_patch": 0},
            format="json",
            HTTP_X_LMSBR_CLIENT="web",
        )
        self.assertEqual(raised.status_code, 200, raised.content)
        lowered = self.client.patch(
            "/api/v3/app-version",
            {"latest_major": 3, "latest_minor": 0, "latest_patch": 0},
            format="json",
            HTTP_X_LMSBR_CLIENT="web",
        )
        self.assertEqual(lowered.status_code, 200, lowered.content)
        self.assertEqual(lowered.data["latest_version_code"], 3)
        self.assertEqual(lowered.data["latest_minor"], 0)

    def test_admin_can_delete_an_old_release(self):
        admin = User.objects.create_superuser(
            username="version-delete",
            email="version-delete@lmsbr.local",
            password="test-pass",
        )
        old = AppVersionRelease.objects.create(
            version_code=30001,
            version_major=3,
            version_minor=0,
            version_patch=1,
            min_version_code=3,
            min_major=3,
            min_minor=0,
            min_patch=0,
            apk_url="https://lmsbr.com/app/ilaalo.apk",
            message="old",
        )
        current = AppVersionRelease.objects.exclude(pk=old.pk).order_by("-id").first()
        self.client.force_authenticate(user=admin)
        blocked = self.client.delete(
            f"/api/v3/app-releases/{current.id}",
            HTTP_X_LMSBR_CLIENT="web",
        )
        self.assertEqual(blocked.status_code, 400, blocked.content)
        self.assertTrue(AppVersionRelease.objects.filter(pk=current.id).exists())
        removed = self.client.delete(
            f"/api/v3/app-releases/{old.id}",
            HTTP_X_LMSBR_CLIENT="web",
        )
        self.assertEqual(removed.status_code, 204, removed.content)
        self.assertFalse(AppVersionRelease.objects.filter(pk=old.id).exists())

    def test_phone_cannot_change_the_release(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            "/api/v3/app-version",
            {"min_version_code": 1},
            format="json",
            HTTP_X_APP_VERSION_CODE="3",
        )
        self.assertEqual(response.status_code, 403)
        old = AppVersionRelease.objects.create(
            version_code=30001,
            version_major=3,
            version_minor=0,
            version_patch=1,
            min_version_code=3,
            min_major=3,
            min_minor=0,
            min_patch=0,
            apk_url="https://lmsbr.com/app/ilaalo.apk",
            message="old",
        )
        denied = self.client.delete(
            f"/api/v3/app-releases/{old.id}",
            HTTP_X_APP_VERSION_CODE="3",
            HTTP_X_LMSBR_CLIENT="web",
        )
        self.assertEqual(denied.status_code, 403)
        self.assertTrue(AppVersionRelease.objects.filter(pk=old.id).exists())

    def test_health_stays_available_for_deploy_checks(self):
        self._raise_minimum(9)
        response = self.client.get("/api/v3/health/")
        self.assertNotEqual(response.status_code, 426)
