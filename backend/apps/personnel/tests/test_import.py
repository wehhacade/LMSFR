from django.test import TestCase
from io import BytesIO
import openpyxl

from django.contrib.auth import get_user_model
from apps.accounts.models import Agent, County, Department, Region
from apps.personnel.models import AgentStatus
from apps.personnel.services.import_service import import_agent_roster, parse_agent_roster_xlsx, reconcile_rows, ParsedAgentRow, normalize_district_name

User = get_user_model()


def _make_sample_xlsx():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["LIISKA DHARCDKA QAYBTA GALBEED"])
    ws.append(["No", "Emp No ", "Name", "Position", "Weapon Name", "Tell ", "Serial Number", "Status"])
    ws.append([1, 999001, "Test Agent One", "Wadajir", "SAR'9", 611111111, "SN001", "active"])
    ws.append(["DEGMADA WADAJIR"])
    ws.append(["No", "Emp No ", "Name", "Position", "Weapon Name", "Tell ", "Serial Number", "Status"])
    ws.append([1, 999002, "Test Agent Two", "Wadajir", "SAR'9", 611111112, "SN002", "active"])
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


class ImportServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="admin", email="admin@test.com", password="pass",
        )
        region = Region.objects.create(name="Banaadir", code="BN")
        self.wadajir = County.objects.create(name="Wadajir", code="WD", region=region)
        self.hodan = County.objects.create(name="Hodan", code="HD", region=region)
        dept = Department.objects.create(name="Qeybta Galbeed Test Section")
        dept.counties.add(self.wadajir)
        self.galbeed_dept = dept
        waliyow = Department.objects.create(name="Qeybta Waliyow Cadde Test")
        waliyow.counties.add(self.hodan)
        self.waliyow_dept = waliyow
        AgentStatus.objects.get_or_create(code="ACTIVE", defaults={"name": "Active", "sort_order": 1})

    def test_parse_hierarchical_xlsx(self):
        rows = parse_agent_roster_xlsx(_make_sample_xlsx(), filename="Liiska Qaybta Galbeed Last.xlsx")
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0].service_id, "999001")
        self.assertEqual(rows[1].district_normalized, "Wadajir")

    def test_yaqshid_district_alias_resolves_to_yaaqshiid(self):
        region = Region.objects.get(code="BN")
        County.objects.get_or_create(name="Yaaqshiid", defaults={"code": "YS", "region": region})
        self.assertEqual(normalize_district_name("DEGMADA YAQSHID"), "Yaaqshiid")
        self.assertEqual(normalize_district_name("Yaqshid"), "Yaaqshiid")
        rows = [
            ParsedAgentRow(
                row_number=1,
                service_id="888101",
                name="Test Yaqshid Agent",
                phone="611888101",
                district_normalized="Yaqshid",
                department_name="Qeybta Bari",
            ),
        ]
        summary = reconcile_rows(rows, department_scope="Qeybta Bari")
        preview = summary.changes_preview[0]
        self.assertNotIn("Unknown district", " ".join(preview.get("errors", [])))

    def test_gubudley_district_alias_resolves_to_gubadley(self):
        region = Region.objects.get(code="BN")
        County.objects.get_or_create(name="Gubadley", defaults={"code": "GB", "region": region})
        self.assertEqual(normalize_district_name("DEGMADA GUBUDLEY"), "Gubadley")
        self.assertEqual(normalize_district_name("Gubudley"), "Gubadley")
        rows = [
            ParsedAgentRow(
                row_number=1,
                service_id="888201",
                name="Test Gubudley Agent",
                phone="611888201",
                district_normalized="Gubudley",
                department_name="Qeybta Bari",
            ),
        ]
        summary = reconcile_rows(rows, department_scope="Qeybta Bari")
        preview = summary.changes_preview[0]
        self.assertNotIn("Unknown district", " ".join(preview.get("errors", [])))

    def test_dry_run_import(self):
        summary = import_agent_roster(
            _make_sample_xlsx(),
            user=self.user,
            filename="Liiska Qaybta Galbeed Last.xlsx",
            dry_run=True,
        )
        self.assertTrue(summary["dry_run"])
        self.assertEqual(summary["total_rows"], 2)
        self.assertEqual(summary["new_agents"], 2)

    def test_apply_import_creates_agents(self):
        summary = import_agent_roster(
            _make_sample_xlsx(),
            user=self.user,
            filename="Liiska Qaybta Galbeed Last.xlsx",
            dry_run=False,
            department_scope="Qeybta Galbeed",
        )
        self.assertFalse(summary["dry_run"])
        self.assertEqual(Agent.objects.filter(service_id__in=["999001", "999002"]).count(), 2)

    def test_apply_import_releases_agents_not_in_excel_from_section(self):
        Agent.objects.create(
            service_id="999102",
            first_name="Old",
            father_name="Section",
            last_name="Agent",
            fourth_name="",
            mother_name="",
            date_of_birth="",
            phone="611111102",
            county=self.wadajir,
            department=self.galbeed_dept,
            recorded_by=self.user,
        )
        summary = import_agent_roster(
            _make_sample_xlsx(),
            user=self.user,
            filename="Liiska Qaybta Galbeed Last.xlsx",
            dry_run=False,
            department_scope="Qeybta Galbeed Test Section",
        )
        self.assertEqual(summary.get("released"), 1)
        released = Agent.objects.get(service_id="999102")
        self.assertIsNone(released.department_id)
        self.assertIsNone(released.county_id)
        self.assertFalse(released.is_archived)

    def test_duplicate_service_ids_block_apply(self):
        rows = [
            ParsedAgentRow(row_number=1, service_id="888001", name="Agent A", district_normalized="Wadajir", department_name="Qeybta Galbeed"),
            ParsedAgentRow(row_number=2, service_id="888001", name="Agent B", district_normalized="Hodan", department_name="Qeybta Waliyow Cadde Test"),
        ]
        summary = reconcile_rows(rows)
        self.assertEqual(summary.conflicts, 1)
        self.assertFalse(summary.ready_to_apply)
        self.assertTrue(any("Duplicate" in e for item in summary.changes_preview for e in item.get("errors", [])))

    def test_matches_existing_agent_by_phone_and_updates_not_creates(self):
        legacy = Agent.objects.create(
            service_id="554",
            first_name="Legacy",
            father_name="Agent",
            last_name="",
            fourth_name="",
            mother_name="",
            date_of_birth="",
            phone="618321831",
            county=self.wadajir,
            recorded_by=self.user,
        )
        rows = [
            ParsedAgentRow(
                row_number=3,
                service_id="010591527",
                name="Sakariye C/naasir Axmed",
                phone="618321831",
                position="Taliye Qeybta",
                department_name="Qeybta Waliyow Cadde Test",
            ),
        ]
        summary = reconcile_rows(rows, department_scope="Qeybta Waliyow Cadde Test")
        self.assertEqual(summary.new_agents, 0)
        self.assertEqual(summary.existing_agents, 1)
        preview = summary.changes_preview[0]
        self.assertEqual(preview["action"], "transfer")
        self.assertEqual(preview["diff"]["position"], "Taliye Qeybta")
        self.assertEqual(preview["diff"]["old_service_id"], "554")
        self.assertEqual(preview["diff"]["new_service_id"], "010591527")
        self.assertTrue(preview["diff"]["section_hq"])

    def test_matches_legacy_agent_by_name_without_phone(self):
        legacy = Agent.objects.create(
            service_id="1685",
            first_name="Cali",
            father_name="C/laahi",
            last_name="Salaad",
            fourth_name="Rooble",
            mother_name="",
            date_of_birth="",
            phone="614945858",
            nickname="200268559",
            county=self.hodan,
            recorded_by=self.user,
        )
        rows = [
            ParsedAgentRow(
                row_number=1,
                service_id="200288559",
                name="Cali C/laahi Salaad Rooble",
                phone="",
                district_normalized="Hodan",
                department_name="Qeybta Waliyow Cadde Test",
            ),
        ]
        summary = reconcile_rows(rows, department_scope="Qeybta Waliyow Cadde Test")
        self.assertEqual(summary.new_agents, 0)
        self.assertEqual(summary.existing_agents, 1)
        preview = summary.changes_preview[0]
        self.assertEqual(preview["action"], "transfer")
        self.assertEqual(preview["diff"]["match_method"], "name")
        self.assertEqual(preview["diff"]["old_service_id"], "1685")
        self.assertEqual(preview["diff"]["new_service_id"], "200288559")
        self.assertEqual(preview["diff"]["new_department"], "Qeybta Waliyow Cadde Test")

    def test_released_agent_in_other_section_excel_is_transfer(self):
        released = Agent.objects.create(
            service_id="777001",
            first_name="Released",
            father_name="Agent",
            last_name="",
            fourth_name="",
            mother_name="",
            date_of_birth="",
            phone="611777001",
            county=None,
            department=None,
            recorded_by=self.user,
        )
        rows = [
            ParsedAgentRow(
                row_number=1,
                service_id="777001",
                name="Released Agent",
                phone="611777001",
                district_normalized="Wadajir",
                department_name="Qeybta Galbeed Test Section",
            ),
        ]
        summary = reconcile_rows(rows, department_scope="Qeybta Galbeed Test Section")
        preview = summary.changes_preview[0]
        self.assertEqual(preview["action"], "transfer")
        self.assertTrue(preview["diff"]["previously_released"])
        self.assertEqual(preview["diff"]["new_district"], "Wadajir")
        self.assertEqual(preview["diff"]["new_department"], "Qeybta Galbeed Test Section")
        self.assertEqual(summary.matched_outside_section, 1)

    def test_apply_transfers_released_agent_into_imported_section(self):
        Agent.objects.create(
            service_id="777002",
            first_name="Released",
            father_name="Two",
            last_name="",
            fourth_name="",
            mother_name="",
            date_of_birth="",
            phone="611777002",
            county=None,
            department=None,
            recorded_by=self.user,
        )
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["LIISKA DHARCDKA QAYBTA GALBEED"])
        ws.append(["No", "Emp No ", "Name", "Position", "Weapon Name", "Tell ", "Serial Number", "Status"])
        ws.append(["DEGMADA WADAJIR"])
        ws.append(["No", "Emp No ", "Name", "Position", "Weapon Name", "Tell ", "Serial Number", "Status"])
        ws.append([1, 777002, "Released Two", "Wadajir", "SAR'9", 611777002, "SN777", "active"])
        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)
        summary = import_agent_roster(
            buf,
            user=self.user,
            filename="Liiska Qaybta Galbeed Last.xlsx",
            dry_run=False,
            department_scope="Qeybta Galbeed Test Section",
        )
        self.assertEqual(summary.get("transferred"), 1)
        agent = Agent.objects.get(service_id="777002")
        self.assertEqual(agent.department_id, self.galbeed_dept.id)
        self.assertEqual(agent.county_id, self.wadajir.id)

    def test_agent_from_other_section_excel_shows_cross_section_transfer(self):
        waliyow = self.waliyow_dept
        other = Agent.objects.create(
            service_id="777003",
            first_name="Other",
            father_name="Section",
            last_name="",
            fourth_name="",
            mother_name="",
            date_of_birth="",
            phone="611777003",
            county=self.hodan,
            department=waliyow,
            recorded_by=self.user,
        )
        rows = [
            ParsedAgentRow(
                row_number=1,
                service_id="777003",
                name="Other Section",
                phone="611777003",
                district_normalized="Wadajir",
                department_name="Qeybta Galbeed Test Section",
            ),
        ]
        summary = reconcile_rows(rows, department_scope="Qeybta Galbeed Test Section")
        preview = summary.changes_preview[0]
        self.assertEqual(preview["action"], "transfer")
        self.assertTrue(preview["diff"]["from_other_section"])
        self.assertEqual(preview["diff"]["old_department"], "Qeybta Waliyow Cadde Test")
        self.assertEqual(preview["diff"]["new_department"], "Qeybta Galbeed Test Section")
        self.assertEqual(preview["diff"]["old_district"], "Hodan")
        self.assertEqual(preview["diff"]["new_district"], "Wadajir")

    def test_phone_conflict_blocks_apply_preview(self):
        Agent.objects.create(
            service_id="532",
            first_name="Phone",
            father_name="Owner",
            last_name="",
            fourth_name="",
            mother_name="",
            date_of_birth="",
            phone="618233191",
            recorded_by=self.user,
        )
        Agent.objects.create(
            service_id="240967957",
            first_name="Matched",
            father_name="By",
            last_name="Name",
            fourth_name="",
            mother_name="",
            date_of_birth="",
            phone="611000001",
            recorded_by=self.user,
        )
        rows = [
            ParsedAgentRow(
                row_number=1,
                service_id="240967957",
                name="Matched By Name",
                phone="618233191",
                district_normalized="Hodan",
                department_name="Qeybta Waliyow Cadde Test",
            ),
        ]
        summary = reconcile_rows(rows, department_scope="Qeybta Waliyow Cadde Test")
        preview = summary.changes_preview[0]
        self.assertEqual(preview["action"], "conflict")
        self.assertFalse(summary.ready_to_apply)
        self.assertTrue(any("618233191" in e for e in preview["errors"]))
        self.assertIn("conflict_agents", preview["diff"])
