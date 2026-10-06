from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.accounts.models import Agent, County, Department, Region, Staff
from apps.personnel.services.import_service import ParsedAgentRow, reconcile_rows
from apps.personnel.services.merge_service import merge_agents

User = get_user_model()


class AgentMergeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="admin", email="admin@test.com", password="pass",
        )
        region = Region.objects.create(name="Banaadir", code="BN")
        self.hodan = County.objects.create(name="Hodan", code="HD", region=region)
        waliyow = Department.objects.create(name="Qeybta Waliyow Cadde")
        waliyow.counties.add(self.hodan)

    def test_nickname_emp_no_wins_over_wrong_phone_match(self):
        Agent.objects.create(
            service_id="9001",
            first_name="Test",
            father_name="Agent",
            last_name="Phone",
            fourth_name="",
            mother_name="",
            date_of_birth="",
            phone="618888001",
            county=self.hodan,
            recorded_by=self.user,
        )
        Agent.objects.create(
            service_id="9002",
            first_name="Test",
            father_name="Agent",
            last_name="Nick",
            fourth_name="",
            mother_name="",
            date_of_birth="",
            phone="619999002",
            nickname="240968088",
            county=self.hodan,
            recorded_by=self.user,
        )
        rows = [
            ParsedAgentRow(
                row_number=1,
                service_id="240968088",
                name="Test Agent Phone",
                phone="0618888001",
                district_normalized="Hodan",
                department_name="Qeybta Waliyow Cadde",
            ),
        ]
        summary = reconcile_rows(rows, department_scope="Qeybta Waliyow Cadde")
        self.assertEqual(summary.conflicts, 0)
        self.assertEqual(summary.existing_agents, 1)
        self.assertEqual(summary.changes_preview[0]["diff"]["match_method"], "nickname")

    def test_merge_combines_true_duplicate_records(self):
        phone_agent = Agent.objects.create(
            service_id="9001",
            first_name="Test",
            father_name="Agent",
            last_name="Phone",
            fourth_name="",
            mother_name="",
            date_of_birth="",
            phone="618888001",
            county=self.hodan,
            recorded_by=self.user,
        )
        nick_agent = Agent.objects.create(
            service_id="9002",
            first_name="Test",
            father_name="Agent",
            last_name="Nick",
            fourth_name="",
            mother_name="",
            date_of_birth="",
            phone="619999002",
            nickname="240968088",
            county=self.hodan,
            recorded_by=self.user,
        )
        merge_agents(
            agent_ids=[phone_agent.pk, nick_agent.pk],
            excel_service_id="240968088",
            preferred_phone="0618888001",
            performed_by=self.user,
        )
        self.assertEqual(Agent.objects.filter(is_archived=False).count(), 1)
        survivor = Agent.objects.filter(is_archived=False).first()
        self.assertEqual(survivor.service_id, "240968088")
        self.assertEqual(survivor.nickname, "240968088")
        self.assertEqual(Agent.objects.filter(pk__in=[phone_agent.pk, nick_agent.pk], is_archived=True).count(), 1)

    def test_sibling_emp_nos_do_not_conflict(self):
        agent_479 = Agent.objects.create(
            service_id="264",
            first_name="Cabdul",
            father_name="Xirsi",
            last_name="Guuleed",
            fourth_name="",
            mother_name="",
            date_of_birth="",
            phone="612904474",
            nickname="230496479",
            county=self.hodan,
            recorded_by=self.user,
        )
        agent_478 = Agent.objects.create(
            service_id="265",
            first_name="Maxamed",
            father_name="Cabdi",
            last_name="Guuleed",
            fourth_name="",
            mother_name="",
            date_of_birth="",
            phone="618233191",
            nickname="230496478",
            county=self.hodan,
            recorded_by=self.user,
        )
        Staff.objects.create(
            employee_id="230496479",
            name="Cabdul Xirsi Axmed Guuleed",
            number="612904474",
            position="Labisan",
            directorate="Amniga G banaadir",
        )
        Staff.objects.create(
            employee_id="230496478",
            name="Maxamed Cabdi Maxamuud Guuleed",
            number="618233191",
            position="Labisan",
            directorate="Amniga G banaadir",
        )

        rows = [
            ParsedAgentRow(
                row_number=1,
                service_id="230496479",
                name="Cabdul Xirsi Axmed Guuleed",
                phone="612804474",
                district_normalized="Labisan",
                department_name="Qeybta Waliyow Cadde",
                is_labisin=True,
            ),
            ParsedAgentRow(
                row_number=2,
                service_id="230496478",
                name="Maxamed Cabdi Maxamuud Guuleed",
                phone="618233191",
                district_normalized="Labisan",
                department_name="Qeybta Waliyow Cadde",
                is_labisin=True,
            ),
        ]
        summary = reconcile_rows(rows, department_scope="Qeybta Waliyow Cadde")
        self.assertEqual(summary.conflicts, 0)
        self.assertEqual(summary.existing_agents, 2)
        preview_by_id = {row["service_id"]: row for row in summary.changes_preview}
        self.assertEqual(preview_by_id["230496479"]["action"], "update")
        self.assertEqual(preview_by_id["230496478"]["action"], "update")
        self.assertIn(preview_by_id["230496479"]["diff"]["match_method"], {"nickname", "staff_payroll"})
        self.assertIn(preview_by_id["230496478"]["diff"]["match_method"], {"nickname", "phone", "staff_payroll"})
        self.assertTrue(Agent.objects.filter(pk=agent_479.pk, is_archived=False).exists())
        self.assertTrue(Agent.objects.filter(pk=agent_478.pk, is_archived=False).exists())

    def test_wrong_excel_phone_does_not_conflict_when_nickname_matches(self):
        agent_479 = Agent.objects.create(
            service_id="264",
            first_name="Cabdul",
            father_name="Xirsi",
            last_name="Guuleed",
            fourth_name="",
            mother_name="",
            date_of_birth="",
            phone="612904474",
            nickname="230496479",
            county=self.hodan,
            recorded_by=self.user,
        )
        Agent.objects.create(
            service_id="265",
            first_name="Maxamed",
            father_name="Cabdi",
            last_name="Guuleed",
            fourth_name="",
            mother_name="",
            date_of_birth="",
            phone="618233191",
            nickname="230496478",
            county=self.hodan,
            recorded_by=self.user,
        )
        rows = [
            ParsedAgentRow(
                row_number=1,
                service_id="230496479",
                name="Cabdul Xirsi Axmed Guuleed",
                phone="618233191",
                district_normalized="Labisan",
                department_name="Qeybta Waliyow Cadde",
                is_labisin=True,
            ),
        ]
        summary = reconcile_rows(rows, department_scope="Qeybta Waliyow Cadde")
        self.assertEqual(summary.conflicts, 0)
        preview = summary.changes_preview[0]
        self.assertEqual(preview["action"], "update")
        self.assertEqual(preview["diff"]["match_method"], "nickname")
        self.assertEqual(preview["diff"]["old_phone"], "612904474")
        self.assertEqual(preview["diff"]["new_phone"], "618233191")
