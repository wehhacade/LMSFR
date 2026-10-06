from __future__ import annotations

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserType
from apps.visitors.models import Visitor


User = get_user_model()


@override_settings(ACCESS_GATEWAY_DEFAULT_SEEDING_REASON_CODE="")
class VisitorsNiraAccessGatewayTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.boqde_type, _ = UserType.objects.get_or_create(name="boqde", defaults={"code": "BQD"})
        cls.boqde_a = User.objects.create_user(
            username="boqde-nira-a",
            email="boqde-nira-a@test.local",
            password="test-pass",
            user_type=cls.boqde_type,
        )
        cls.boqde_a.is_active = True
        cls.boqde_a.save()

        # Ensure at least one record exists (not required but keeps dataset realistic).
        Visitor.objects.create(full_name="Seed Guest", created_by=cls.boqde_a, verified=False)

    def test_nira_reasons_default_first(self):
        self.client.force_authenticate(user=self.boqde_a)
        reasons_payload = [
            {"code": "R1", "label": "Reason 1"},
            {"code": "R2", "label": "Reason 2"},
        ]

        with patch(
            "apps.visitors.views.get_seeding_reasons",
            return_value=reasons_payload,
        ):
            resp = self.client.get("/api/v3/visitors/nira/reasons/", format="json")
            self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
            self.assertFalse(resp.data["isError"])
            self.assertEqual(resp.data["defaultReasonCode"], "R1")
            self.assertEqual(len(resp.data["reasons"]), 2)

    def test_nira_initiate_uses_default_reason_when_missing(self):
        self.client.force_authenticate(user=self.boqde_a)

        reasons_payload = [{"code": "R1", "label": "Reason 1"}]
        gateway_init_response = {"otpConsentId": "uuid-consent-1"}

        with patch("apps.visitors.views.get_seeding_reasons", return_value=reasons_payload), patch(
            "apps.visitors.views.initiate_seeding_otp",
            return_value=gateway_init_response,
        ) as init_mock:
            resp = self.client.post(
                "/api/v3/visitors/nira/initiate/",
                {"idNumber": "NIRA-123"},
                format="json",
            )
            self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
            self.assertFalse(resp.data["isError"])
            self.assertFalse(resp.data["found"])
            self.assertEqual(resp.data["source"], "nira")
            self.assertEqual(resp.data["reasonCode"], "R1")
            init_mock.assert_called_once()
            _, kwargs = init_mock.call_args
            self.assertEqual(kwargs["seeding_reason_code"], "R1")

    def test_nira_initiate_returns_local_visitor_without_gateway(self):
        self.client.force_authenticate(user=self.boqde_a)
        Visitor.objects.create(
            full_name="Test Return Visitor",
            nira="99900011122",
            created_by=self.boqde_a,
            verified=False,
        )

        with patch("apps.visitors.views.initiate_seeding_otp") as init_mock:
            resp = self.client.post(
                "/api/v3/visitors/nira/initiate/",
                {"idNumber": "99900011122"},
                format="json",
            )
            self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
            self.assertFalse(resp.data["isError"])
            self.assertTrue(resp.data["found"])
            self.assertEqual(resp.data["source"], "local")
            self.assertTrue(resp.data["gatewaySkipped"])
            self.assertEqual(resp.data["visitor"]["nira"], "99900011122")
            init_mock.assert_not_called()

    def test_lookup_by_nira_post_and_get(self):
        self.client.force_authenticate(user=self.boqde_a)
        Visitor.objects.create(
            full_name="Lookup Guest",
            nira="ABC-LOOKUP-1",
            created_by=self.boqde_a,
        )

        get_resp = self.client.get("/api/v3/visitors/lookup/", {"nira": "ABC-LOOKUP-1"})
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK, get_resp.data)
        self.assertTrue(get_resp.data["found"])
        self.assertEqual(get_resp.data["source"], "local")

        post_resp = self.client.post(
            "/api/v3/visitors/lookup/",
            {"idNumber": "abc-lookup-1"},
            format="json",
        )
        self.assertEqual(post_resp.status_code, status.HTTP_200_OK, post_resp.data)
        self.assertTrue(post_resp.data["found"])
        self.assertEqual(post_resp.data["visitor"]["full_name"], "Lookup Guest")

    def test_placeholder_nira_does_not_return_local_visitor(self):
        """Flow B3: nira=0 / short junk must not short-circuit as returning."""
        self.client.force_authenticate(user=self.boqde_a)
        Visitor.objects.create(
            full_name="Should Not Match",
            nira="",
            created_by=self.boqde_a,
        )

        for payload in ({"nira": "0"}, {"idNumber": "08"}, {"nira": "88"}):
            lookup = self.client.post("/api/v3/visitors/lookup/", payload, format="json")
            self.assertEqual(lookup.status_code, status.HTTP_400_BAD_REQUEST, lookup.data)

            initiate = self.client.post("/api/v3/visitors/nira/initiate/", payload, format="json")
            self.assertEqual(initiate.status_code, status.HTTP_400_BAD_REQUEST, initiate.data)

    def test_nira_profile_missing_fields_400(self):
        self.client.force_authenticate(user=self.boqde_a)
        resp = self.client.post(
            "/api/v3/visitors/nira/profile/",
            {"otpCode": "0000"},  # missing idNumber + otpConsentId
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

