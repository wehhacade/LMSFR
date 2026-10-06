from rest_framework.test import APITestCase
from django.contrib.auth.models import Group

from apps.accounts.models import Agent, County, Department, User
from apps.mobile.models import AgentAppInstallation


class AppInstallationChecklistTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_superuser(
            username="install-admin",
            email="install-admin@lmsbr.local",
            password="test-pass",
        )
        cls.department = Department.objects.create(name="Qeybta Test")
        cls.county = County.objects.create(name="Degmada Test")
        cls.other_county = County.objects.create(name="Degmada Kale")
        cls.department.counties.add(cls.county)
        cls.agent_user = User.objects.create_user(
            username="agent-install",
            email="agent-install@lmsbr.local",
            password="test-pass",
            first_name="Cali",
            last_name="Xasan",
            phone="0612345678",
            is_agent=True,
            county=cls.county,
            department=cls.department,
        )
        Agent.objects.create(
            user=cls.agent_user,
            service_id="EMP-9876",
            nickname="270469876",
            first_name="Cali",
            father_name="Maxamed",
            last_name="Xasan",
            fourth_name="Nuur",
            mother_name="Sahra",
            date_of_birth="1990-01-01",
            phone="0612345678",
            county=cls.county,
        )
        cls.permission_group = Group.objects.create(name="TipPhone Test Permission")
        cls.agent_user.groups.add(cls.permission_group)

        cls.second_department = Department.objects.create(name="Qeybta Labaad")
        cls.second_county = County.objects.create(name="Degmada Labaad")
        cls.second_department.counties.add(cls.second_county)
        cls.second_agent = User.objects.create_user(
            username="agent-cross",
            email="agent-cross@lmsbr.local",
            password="test-pass",
            first_name="Axmed",
            last_name="Cali",
            phone="0611112222",
            is_agent=True,
            county=cls.second_county,
            department=cls.second_department,
        )
        Agent.objects.create(
            user=cls.second_agent,
            service_id="EMP-5555",
            nickname="270465555",
            first_name="Axmed",
            father_name="Cali",
            last_name="Xasan",
            fourth_name="Nuur",
            mother_name="Sahra",
            date_of_birth="1991-01-01",
            phone="0611112222",
            county=cls.second_county,
        )

        cls.same_dept_county = County.objects.create(name="Degmada Same Qeyb")
        cls.department.counties.add(cls.same_dept_county)
        cls.same_dept_agent = User.objects.create_user(
            username="agent-same-dept",
            email="agent-same-dept@lmsbr.local",
            password="test-pass",
            first_name="Faarax",
            last_name="Cumar",
            phone="0613334444",
            is_agent=True,
            county=cls.same_dept_county,
            department=cls.department,
        )
        Agent.objects.create(
            user=cls.same_dept_agent,
            service_id="EMP-4444",
            nickname="270464444",
            first_name="Faarax",
            father_name="Cumar",
            last_name="Xasan",
            fourth_name="Nuur",
            mother_name="Sahra",
            date_of_birth="1992-01-01",
            phone="0613334444",
            county=cls.same_dept_county,
        )

    def setUp(self):
        self.client.force_authenticate(self.admin)

    def test_department_returns_only_its_counties(self):
        response = self.client.get("/api/v3/app-installation/departments")
        self.assertEqual(response.status_code, 200)
        row = next(item for item in response.data["Message"] if item["id"] == self.department.id)
        self.assertEqual(
            row["counties"],
            [
                {"id": self.same_dept_county.id, "name": self.same_dept_county.name},
                {"id": self.county.id, "name": self.county.name},
            ],
        )
        self.assertNotIn(
            {"id": self.other_county.id, "name": self.other_county.name},
            row["counties"],
        )
        self.assertNotIn(
            {"id": self.second_county.id, "name": self.second_county.name},
            row["counties"],
        )

    def test_last_four_employee_search_and_persistent_check(self):
        payload = {
            "department_id": self.department.id,
            "county_id": self.county.id,
            "searchQuery": "9876",
            "page": 1,
        }
        before = self.client.post("/api/v3/app-installation/users", payload, format="json")
        self.assertEqual(before.status_code, 200)
        self.assertEqual(len(before.data["Message"]), 1)
        self.assertEqual(before.data["Message"][0]["installation_label"], "Looguma shubin")
        self.assertEqual(
            before.data["Message"][0]["login_username"],
            self.agent_user.email,
        )
        self.assertEqual(
            before.data["Message"][0]["groups"],
            [{"id": self.permission_group.id, "name": self.permission_group.name}],
        )
        self.assertEqual(before.data["summary"]["not_installed"], 1)

        updated = self.client.post(
            "/api/v3/app-installation/update",
            {"user_id": self.agent_user.id, "installed": True},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["Message"]["installation_status"], "completed")
        self.assertEqual(updated.data["Message"]["installation_label"], "Loogu shubay")
        self.assertTrue(
            AgentAppInstallation.objects.get(user=self.agent_user).installed
        )

        after = self.client.post("/api/v3/app-installation/users", payload, format="json")
        self.assertTrue(after.data["Message"][0]["app_installed"])
        self.assertEqual(after.data["summary"]["installed"], 1)
        self.assertEqual(after.data["summary"]["completed"], 1)
        self.assertEqual(after.data["summary"]["iphone"], 0)
        self.assertEqual(after.data["summary"]["not_installed"], 0)

        report = self.client.get(
            "/api/v3/accounts/agents/app-users/",
            {
                "report": "true",
                "county": self.county.id,
                "department": self.department.id,
                "installation_status": "installed",
            },
        )
        self.assertEqual(report.status_code, 200)
        self.assertEqual(len(report.data), 1)
        self.assertTrue(report.data[0]["app_installed"])
        self.assertEqual(report.data[0]["installation_status"], "completed")
        self.assertEqual(report.data[0]["installation_label"], "Loogu shubay")

        iphone = self.client.post(
            "/api/v3/app-installation/update",
            {"user_id": self.agent_user.id, "status": "iphone"},
            format="json",
        )
        self.assertEqual(iphone.status_code, 200)
        self.assertEqual(iphone.data["Message"]["installation_label"], "iPhone")
        record = AgentAppInstallation.objects.get(user=self.agent_user)
        self.assertEqual(record.status, "iphone")
        self.assertFalse(record.installed)
        self.assertIsNone(record.installed_at)

        iphone_payload = {**payload, "installation_status": "iphone"}
        iphone_list = self.client.post(
            "/api/v3/app-installation/users", iphone_payload, format="json"
        )
        self.assertEqual(len(iphone_list.data["Message"]), 1)
        self.assertEqual(iphone_list.data["summary"]["iphone"], 1)
        self.assertEqual(iphone_list.data["summary"]["completed"], 0)
        self.assertEqual(iphone_list.data["summary"]["not_installed"], 0)

        iphone_report = self.client.get(
            "/api/v3/accounts/agents/app-users/",
            {
                "report": "true",
                "county": self.county.id,
                "department": self.department.id,
                "installation_status": "iphone",
            },
        )
        self.assertEqual(len(iphone_report.data), 1)
        self.assertEqual(iphone_report.data[0]["installation_status"], "iphone")

    def test_rejects_county_outside_department(self):
        response = self.client.post(
            "/api/v3/app-installation/users",
            {
                "department_id": self.department.id,
                "county_id": self.other_county.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["isError"])

    def test_department_scope_with_county_zero_returns_all_department_counties(self):
        response = self.client.post(
            "/api/v3/app-installation/users",
            {
                "department_id": self.department.id,
                "county_id": 0,
                "page": 1,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["isError"])
        ids = {row["id"] for row in response.data["Message"]}
        self.assertIn(self.agent_user.id, ids)
        self.assertIn(self.same_dept_agent.id, ids)
        self.assertNotIn(self.second_agent.id, ids)

    def test_unscoped_search_requires_two_characters(self):
        empty = self.client.post(
            "/api/v3/app-installation/users",
            {"department_id": 0, "county_id": 0, "searchQuery": ""},
            format="json",
        )
        self.assertTrue(empty.data["isError"])

        short = self.client.post(
            "/api/v3/app-installation/users",
            {"department_id": 0, "county_id": 0, "searchQuery": "A"},
            format="json",
        )
        self.assertTrue(short.data["isError"])

        county_without_department = self.client.post(
            "/api/v3/app-installation/users",
            {"department_id": 0, "county_id": self.county.id, "searchQuery": "Ca"},
            format="json",
        )
        self.assertTrue(county_without_department.data["isError"])

    def test_unscoped_search_returns_cross_county_matches(self):
        response = self.client.post(
            "/api/v3/app-installation/users",
            {
                "department_id": 0,
                "county_id": 0,
                "searchQuery": "5555",
                "page": 1,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["isError"])
        self.assertEqual(len(response.data["Message"]), 1)
        self.assertEqual(response.data["Message"][0]["id"], self.second_agent.id)

        by_name = self.client.post(
            "/api/v3/app-installation/users",
            {
                "department_id": 0,
                "county_id": 0,
                "searchQuery": "Ca",
                "page": 1,
            },
            format="json",
        )
        ids = {row["id"] for row in by_name.data["Message"]}
        self.assertIn(self.agent_user.id, ids)
        self.assertIn(self.second_agent.id, ids)

    def test_four_digits_match_employee_number_not_phone_tail(self):
        payload = {
            "department_id": self.department.id,
            "county_id": self.county.id,
            "page": 1,
        }
        # 5678 is the tail of agent phone 0612345678 but no employee number.
        phone_tail = self.client.post(
            "/api/v3/app-installation/users",
            {**payload, "searchQuery": "5678"},
            format="json",
        )
        self.assertEqual(phone_tail.status_code, 200)
        self.assertEqual(phone_tail.data["Message"], [])

        emp_tail = self.client.post(
            "/api/v3/app-installation/users",
            {**payload, "searchQuery": "9876"},
            format="json",
        )
        self.assertEqual(
            [row["id"] for row in emp_tail.data["Message"]], [self.agent_user.id]
        )

        # service_id exact "1584" must NOT match a 4-digit EMP search.
        Agent.objects.filter(user=self.same_dept_agent).update(service_id="1584")
        service_id_only = self.client.post(
            "/api/v3/app-installation/users",
            {
                "department_id": self.department.id,
                "county_id": 0,
                "searchQuery": "1584",
                "page": 1,
            },
            format="json",
        )
        self.assertEqual(service_id_only.data["Message"], [])

    def test_phone_search_requires_full_number(self):
        payload = {
            "department_id": self.department.id,
            "county_id": self.county.id,
            "page": 1,
        }
        partial = self.client.post(
            "/api/v3/app-installation/users",
            {**payload, "searchQuery": "61234"},
            format="json",
        )
        self.assertEqual(partial.data["Message"], [])

        for full in ("0612345678", "612345678"):
            found = self.client.post(
                "/api/v3/app-installation/users",
                {**payload, "searchQuery": full},
                format="json",
            )
            self.assertEqual(
                [row["id"] for row in found.data["Message"]],
                [self.agent_user.id],
                msg=f"phone {full} should match exactly one agent",
            )

    def test_not_installed_reason_persists_filters_and_clears(self):
        updated = self.client.post(
            "/api/v3/app-installation/update",
            {
                "user_id": self.agent_user.id,
                "status": "not_installed",
                "not_installed_reason": "did_not_attend",
            },
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(
            updated.data["Message"]["not_installed_reason_label"], "Ma imaanin"
        )

        payload = {
            "department_id": self.department.id,
            "county_id": self.county.id,
            "installation_status": "not_installed",
            "not_installed_reason": "did_not_attend",
        }
        listed = self.client.post(
            "/api/v3/app-installation/users", payload, format="json"
        )
        self.assertEqual(len(listed.data["Message"]), 1)
        self.assertEqual(
            listed.data["Message"][0]["not_installed_reason"], "did_not_attend"
        )

        report = self.client.get(
            "/api/v3/accounts/agents/app-users/",
            {
                "report": "true",
                "county": self.county.id,
                "not_installed_reason": "did_not_attend",
            },
        )
        self.assertEqual(len(report.data), 1)
        self.assertEqual(report.data[0]["not_installed_reason_label"], "Ma imaanin")

        other = self.client.post(
            "/api/v3/app-installation/update",
            {
                "user_id": self.agent_user.id,
                "status": "not_installed",
                "not_installed_reason": "other",
                "not_installed_reason_detail": "Safar ayuu ku maqnaa",
            },
            format="json",
        )
        self.assertEqual(
            other.data["Message"]["not_installed_reason_detail"],
            "Safar ayuu ku maqnaa",
        )

        completed = self.client.post(
            "/api/v3/app-installation/update",
            {"user_id": self.agent_user.id, "status": "completed"},
            format="json",
        )
        self.assertEqual(completed.data["Message"]["not_installed_reason"], "")
        record = AgentAppInstallation.objects.get(user=self.agent_user)
        self.assertEqual(record.not_installed_reason, "")
        self.assertEqual(record.not_installed_reason_detail, "")

    def test_permission_groups_can_be_listed_and_assigned_like_app_users(self):
        groups = self.client.get("/api/v3/accounts/groups/", {"page_size": 200})
        self.assertEqual(groups.status_code, 200)
        self.assertIn(
            self.permission_group.id,
            [row["id"] for row in groups.data["results"]],
        )

        second_group = Group.objects.create(name="TipPhone Assigned Permission")
        assigned = self.client.post(
            f"/api/v3/accounts/users/{self.agent_user.id}/assign_groups/",
            {"group_ids": [second_group.id]},
            format="json",
        )
        self.assertEqual(assigned.status_code, 200)
        self.assertEqual(
            list(self.agent_user.groups.values_list("id", flat=True)),
            [second_group.id],
        )

    def test_password_reset_returns_actual_username_and_password(self):
        response = self.client.post(
            "/api/v3/reset-user-password",
            {"user_id": self.agent_user.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["isError"])
        self.assertEqual(response.data["Message"]["username"], self.agent_user.email)
        self.assertEqual(response.data["Message"]["password"], "612345678")
        self.agent_user.refresh_from_db()
        self.assertTrue(self.agent_user.check_password("612345678"))

    def test_change_user_county_updates_user_and_agent(self):
        response = self.client.post(
            "/api/v3/users/change-county",
            {"user_id": self.agent_user.id, "county_id": self.other_county.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["isError"])
        self.assertEqual(response.data["Message"]["user_id"], self.agent_user.id)
        self.assertEqual(response.data["Message"]["county_id"], self.other_county.id)
        self.assertEqual(response.data["Message"]["county_name"], self.other_county.name)
        self.assertEqual(response.data["Message"]["old_county_name"], self.county.name)

        self.agent_user.refresh_from_db()
        agent = Agent.objects.get(user=self.agent_user)
        self.assertEqual(self.agent_user.county_id, self.other_county.id)
        self.assertEqual(agent.county_id, self.other_county.id)

    def test_change_user_county_forbidden_for_non_admin(self):
        self.client.force_authenticate(self.agent_user)
        response = self.client.post(
            "/api/v3/users/change-county",
            {"user_id": self.agent_user.id, "county_id": self.other_county.id},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertTrue(response.data["isError"])

    def test_change_user_county_invalid_county_and_user(self):
        missing_county = self.client.post(
            "/api/v3/users/change-county",
            {"user_id": self.agent_user.id, "county_id": 999999},
            format="json",
        )
        self.assertEqual(missing_county.status_code, 404)
        self.assertTrue(missing_county.data["isError"])

        missing_user = self.client.post(
            "/api/v3/users/change-county",
            {"user_id": 999999, "county_id": self.other_county.id},
            format="json",
        )
        self.assertEqual(missing_user.status_code, 404)
        self.assertTrue(missing_user.data["isError"])
