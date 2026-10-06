from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db.models import Case, Count, IntegerField, Prefetch, Q, Value, When
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import (
    Agent,
    AgentAccess,
    AgentChild,
    AgentFile,
    AgentRelative,
    AgentSpouse,
    County,
    Department,
)
from apps.accounts.call_roles import (
    is_dev,
    is_taliye_all,
    is_taliye_degmo,
    is_taliye_qebeed,
    qeyb_county_ids,
)
from apps.accounts.permissions import AgentPermission, IsActiveUser
from apps.accounts.serializers.agent import (
    AgentAccessSerializer,
    AgentAppUserSerializer,
    AgentChildSerializer,
    AgentDetailSerializer,
    AgentFileSerializer,
    AgentListSerializer,
    AgentRelativeSerializer,
    AgentSpouseSerializer,
    AgentWriteSerializer,
)
from apps.accounts.services.hrm_client import fetch_hrm_employees, hrm_configured, parse_search_terms
from apps.accounts.services.app_activity import (
    APP_INACTIVE_AFTER,
    APP_WARNING_AFTER,
    annotate_last_app_activity,
    login_event_payload,
    mobile_login_events,
)
from apps.accounts.services.staff_search import (
    agents_matches_term,
    app_users_search_q,
    search_staff_and_agents,
)
from apps.accounts.services.create_from_staff import create_agent_from_staff
from apps.accounts.views.users import AccountsPagination
from apps.audit.mixins import AuditedViewSetMixin
from apps.audit.models import AuditTrail
from apps.suspects.models import Suspect
from apps.suspects.serializers import SuspectListSerializer

User = get_user_model()


class AppUsersPagination(AccountsPagination):
    page_size = 10
    max_page_size = 100


def _reset_password_to_phone(user) -> tuple[bool, str]:
    phone = (user.phone or "").replace(" ", "").strip()
    if not phone:
        return False, "User has no phone number on record."
    user.set_password(phone)
    user.password_changed = False
    user.save(update_fields=["password", "password_changed"])
    return True, phone


def _agent_search_dict(agent: Agent) -> dict:
    from apps.accounts.services.staff_search import agent_to_search_dict

    return agent_to_search_dict(agent)


def _agents_matching_term(term: str):
    return agents_matches_term(term)


class AgentViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    audit_module = "usercontrol"
    audit_entity = "agent"
    permission_classes = [IsAuthenticated, IsActiveUser, AgentPermission]
    pagination_class = AccountsPagination
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        qs = Agent.objects.select_related(
            "user", "user__county", "user__user_type", "user__department", "county", "directorate",
        ).order_by("-created_at")
        if self.action == "retrieve":
            qs = qs.annotate(
                access_count=Count("access_records", distinct=True),
                relatives_count=Count("relatives", distinct=True),
                files_count=Count("files", distinct=True),
                captured_suspects_count=Count("user__registered_suspects", distinct=True),
            )
        if self.action == "app_users":
            qs = (
                Agent.objects.select_related(
                    "user",
                    "user__county",
                    "user__user_type",
                    "user__department",
                    "user__app_installation",
                    "county",
                    "directorate",
                )
                .prefetch_related(Prefetch("user__groups", queryset=Group.objects.only("id", "name")))
                .exclude(user__is_superuser=True)
                .annotate(
                    _has_user=Case(
                        When(user_id__isnull=False, then=Value(0)),
                        default=Value(1),
                        output_field=IntegerField(),
                    ),
                    _inactive=Case(
                        When(user__is_active=True, user__suspend=False, then=Value(0)),
                        default=Value(1),
                        output_field=IntegerField(),
                    ),
                )
                .order_by("_inactive", "_has_user", "-service_id")
            )
            qs = annotate_last_app_activity(qs)
            qs = self._scope_to_caller(qs)
        search = self.request.query_params.get("search", "").strip()
        if search:
            search_q = app_users_search_q(search)
            if search_q is not None:
                qs = qs.filter(search_q).distinct()

        county = self.request.query_params.get("county", "").strip()
        if county:
            qs = qs.filter(Q(county_id=county) | Q(user__county_id=county))

        department = self.request.query_params.get("department", "").strip()
        if department and self.action == "app_users":
            # Qeybta = department with linked counties; list agents in those
            # districts (and anyone explicitly assigned to the department).
            county_ids = list(
                Department.objects.filter(pk=department)
                .values_list("counties__id", flat=True)
                .distinct()
            )
            county_ids = [cid for cid in county_ids if cid is not None]
            dept_q = Q(user__department_id=department)
            if county_ids:
                qs = qs.filter(
                    Q(county_id__in=county_ids)
                    | Q(user__county_id__in=county_ids)
                    | dept_q
                )
            else:
                qs = qs.filter(dept_q)

        activity_status = self.request.query_params.get("activity_status", "").strip().lower()
        if activity_status and self.action == "app_users":
            now = timezone.now()
            warning_cutoff = now - APP_WARNING_AFTER
            inactive_cutoff = now - APP_INACTIVE_AFTER
            if activity_status == "active":
                qs = qs.filter(last_app_activity__gt=warning_cutoff)
            elif activity_status == "warning":
                qs = qs.filter(
                    last_app_activity__lte=warning_cutoff,
                    last_app_activity__gt=inactive_cutoff,
                )
            elif activity_status == "inactive":
                qs = qs.filter(last_app_activity__lte=inactive_cutoff)
            elif activity_status == "never":
                qs = qs.filter(last_app_activity__isnull=True)

        installation_status = (
            self.request.query_params.get("installation_status", "").strip().lower()
        )
        if installation_status and self.action == "app_users":
            if installation_status in ("installed", "completed"):
                qs = qs.filter(user__app_installation__status="completed")
            elif installation_status == "iphone":
                qs = qs.filter(user__app_installation__status="iphone")
            elif installation_status == "not_installed":
                qs = qs.exclude(
                    user__app_installation__status__in=["completed", "iphone"]
                )

        not_installed_reason = (
            self.request.query_params.get("not_installed_reason", "").strip().lower()
        )
        if not_installed_reason and self.action == "app_users":
            qs = qs.filter(
                user__app_installation__status="not_installed",
                user__app_installation__not_installed_reason=not_installed_reason,
            )

        present = self.request.query_params.get("present", "").strip()
        if present:
            qs = qs.filter(present=present)

        active = self.request.query_params.get("active", "").strip().lower()
        if active in ("1", "true", "yes"):
            qs = qs.filter(user__is_active=True, user__suspend=False)
        elif active in ("0", "false", "no"):
            qs = qs.filter(Q(user__is_active=False) | Q(user__suspend=True) | Q(user__isnull=True))

        if self.action == "login_activity":
            qs = self._scope_to_caller(qs)

        return qs

    def _scope_to_caller(self, qs):
        """Section/district commanders only see their own counties; dev & HQ see all."""
        caller = self.request.user
        if is_dev(caller) or is_taliye_all(caller):
            return qs
        if is_taliye_qebeed(caller):
            county_ids = qeyb_county_ids(caller)
            if not county_ids:
                return qs.none()
            return qs.filter(Q(county_id__in=county_ids) | Q(user__county_id__in=county_ids))
        if is_taliye_degmo(caller):
            county_id = getattr(caller, "county_id", None)
            if not county_id:
                return qs.none()
            return qs.filter(Q(county_id=county_id) | Q(user__county_id=county_id))
        return qs

    def get_serializer_class(self):
        if self.action == "app_users":
            return AgentAppUserSerializer
        if self.action == "retrieve":
            return AgentDetailSerializer
        if self.action in ("create", "update", "partial_update"):
            return AgentWriteSerializer
        return AgentListSerializer

    def get_pagination_class(self):
        if self.action == "app_users":
            return AppUsersPagination
        return AccountsPagination

    @property
    def paginator(self):
        """Use larger page sizes for the app-users admin list."""
        if not hasattr(self, "_paginator"):
            cls = self.get_pagination_class()
            self._paginator = cls() if cls is not None else None
        return self._paginator

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        user = instance.user
        if user and instance.county_id and not user.county_id:
            user.county_id = instance.county_id
            user.save(update_fields=["county"])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def perform_create(self, serializer):
        return super().perform_create(serializer)

    def perform_update(self, serializer):
        return super().perform_update(serializer)

    def perform_destroy(self, instance):
        return super().perform_destroy(instance)

    def _nested(self, request, pk, model, serializer_class, label):
        agent = self.get_object()
        if request.method == "GET":
            rows = model.objects.filter(agent=agent).order_by("-created_at")
            return Response(serializer_class(rows, many=True, context={"request": request}).data)
        serializer = serializer_class(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save(agent=agent)
        self._audit_log(
            AuditTrail.EventType.CREATE,
            f"Added {label} for agent {agent.personal_number}",
            entity_id=agent.pk,
            details={"nested": label},
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="app-users")
    def app_users(self, request):
        """Amniga Isticmalaayasha — paginated agents with account columns."""
        qs = self.filter_queryset(self.get_queryset())
        if request.query_params.get("report", "").lower() in ("1", "true", "yes"):
            serializer = self.get_serializer(qs[:5000], many=True)
            return Response(serializer.data)
        page = self.paginate_queryset(qs)
        serializer = self.get_serializer(page if page is not None else qs, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="login-activity")
    def login_activity(self, request, pk=None):
        """Exact recent mobile login/open events for one scoped agent."""
        agent = self.get_object()
        if not agent.user_id:
            return Response({"agent_id": str(agent.pk), "results": []})
        trails = (
            mobile_login_events()
            .filter(user_id=agent.user_id)
            .order_by("-created_at")[:20]
        )
        return Response({
            "agent_id": str(agent.pk),
            "user_id": agent.user_id,
            "name": agent.personal_fullname or agent.personal_number,
            "county": agent.county.name if agent.county_id else "",
            "results": [login_event_payload(row, agent.user) for row in trails],
        })

    @action(detail=False, methods=["post"], url_path="bulk-reset-passwords")
    def bulk_reset_passwords(self, request):
        """Superuser: reset selected (or all-in-county) agent passwords to phone."""
        if not request.user.is_superuser:
            return Response({"detail": "Superuser only."}, status=status.HTTP_403_FORBIDDEN)

        county_id = str(request.data.get("county_id") or "").strip()
        select_all = str(request.data.get("select_all_in_county") or "").lower() in ("1", "true", "yes")
        user_ids = request.data.get("user_ids") or []

        if not county_id:
            return Response({"detail": "Please select a county."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            county = County.objects.get(pk=county_id)
        except County.DoesNotExist:
            return Response({"detail": "Invalid county."}, status=status.HTTP_400_BAD_REQUEST)

        if select_all:
            agents = (
                Agent.objects.filter(county_id=county_id, user__isnull=False)
                .exclude(user__is_superuser=True)
                .select_related("user")
            )
            users = [a.user for a in agents if a.user_id]
        else:
            try:
                ids = [int(uid) for uid in user_ids]
            except (TypeError, ValueError):
                return Response({"detail": "Invalid user selection."}, status=status.HTTP_400_BAD_REQUEST)
            if not ids:
                return Response({"detail": "Select at least one agent."}, status=status.HTTP_400_BAD_REQUEST)
            valid_ids = set(
                Agent.objects.filter(county_id=county_id, user_id__in=ids)
                .exclude(user__is_superuser=True)
                .values_list("user_id", flat=True)
            )
            users = list(User.objects.filter(pk__in=valid_ids).exclude(is_superuser=True))

        if not users:
            return Response(
                {"detail": "No eligible agents found for the selected county."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reset_count = 0
        skipped = []
        for target in users:
            if target.pk == request.user.pk:
                skipped.append({"username": target.username, "reason": "Cannot reset your own password"})
                continue
            ok, result = _reset_password_to_phone(target)
            if not ok:
                skipped.append({"username": target.username, "reason": result})
                continue
            self._audit_log(
                AuditTrail.EventType.UPDATE,
                f"Bulk password reset to phone for {target.email or target.username}",
                entity_id=target.pk,
            )
            reset_count += 1

        return Response({
            "success": True,
            "reset_count": reset_count,
            "skipped": skipped,
            "county_name": county.name,
            "message": f"Reset {reset_count} password(s) to phone number in {county.name}."
            + (f" Skipped {len(skipped)}." if skipped else ""),
        })

    @action(detail=True, methods=["post"], url_path="reset-password-to-phone")
    def reset_password_to_phone(self, request, pk=None):
        agent = self.get_object()
        if not agent.user_id:
            return Response({"detail": "Agent has no linked user."}, status=status.HTTP_400_BAD_REQUEST)
        if agent.user.is_superuser:
            return Response({"detail": "Cannot reset superuser password."}, status=status.HTTP_403_FORBIDDEN)
        if agent.user_id == request.user.pk:
            return Response({"detail": "Cannot reset your own password this way."}, status=status.HTTP_400_BAD_REQUEST)
        ok, result = _reset_password_to_phone(agent.user)
        if not ok:
            return Response({"detail": result}, status=status.HTTP_400_BAD_REQUEST)
        self._audit_log(
            AuditTrail.EventType.UPDATE,
            f"Password reset to phone for {agent.user.email or agent.user.username}",
            entity_id=agent.pk,
        )
        return Response({"detail": "Password reset to phone number.", "phone_hint": result[-4:]})

    @action(detail=False, methods=["get"], url_path="search-staff")
    def search_staff(self, request):
        """Staff payroll + local agents lookup (Search Staff)."""
        return Response(search_staff_and_agents(request.query_params.get("search", "")))

    @action(detail=False, methods=["post"], url_path="change-county")
    def change_county(self, request):
        """Update county on both Agent and linked User (Search Staff parity with v2)."""
        service_id = str(request.data.get("service_id") or "").strip()
        agent_id = str(request.data.get("agent_id") or "").strip()
        county_id = str(request.data.get("county_id") or "").strip()

        if not county_id:
            return Response({"detail": "County is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not service_id and not agent_id:
            return Response(
                {"detail": "Service ID or agent ID is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            county = County.objects.get(pk=county_id)
        except County.DoesNotExist:
            return Response({"detail": "County not found."}, status=status.HTTP_404_NOT_FOUND)

        agent_qs = Agent.objects.select_related("user", "county")
        try:
            if agent_id:
                agent = agent_qs.get(pk=agent_id)
            else:
                agent = agent_qs.get(service_id=service_id)
        except Agent.DoesNotExist:
            return Response({"detail": "Agent not found."}, status=status.HTTP_404_NOT_FOUND)
        except Agent.MultipleObjectsReturned:
            return Response(
                {"detail": "Multiple agents share this service ID; open by agent id."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_county_name = agent.county.name if agent.county_id else "None"
        agent.county = county
        agent.save(update_fields=["county"])

        user_updated = False
        if agent.user_id:
            agent.user.county = county
            agent.user.save(update_fields=["county"])
            user_updated = True

        self._audit_log(
            AuditTrail.EventType.UPDATE,
            (
                f"Changed agent county for {agent.personal_number} "
                f"({old_county_name} → {county.name})"
            ),
            entity_id=agent.pk,
        )

        return Response({
            "success": True,
            "message": f"County updated to {county.name}",
            "agent_id": str(agent.pk),
            "service_id": agent.service_id,
            "county_id": str(county.pk),
            "county_name": county.name,
            "user_updated": user_updated,
        })

    @action(detail=False, methods=["post"], url_path="create-from-staff", parser_classes=[MultiPartParser, FormParser, JSONParser])
    def create_from_staff(self, request):
        """Create agent + user from Staff payroll row."""
        employee_id = str(request.data.get("employee_id") or "").strip()
        gender = str(request.data.get("gender") or "Male").strip()
        county_id = request.data.get("county_id") or None
        profile = request.FILES.get("profile")
        try:
            agent, user = create_agent_from_staff(
                employee_id=employee_id,
                gender=gender,
                county_id=county_id,
                profile=profile,
                recorded_by=request.user,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        self._audit_log(
            AuditTrail.EventType.CREATE,
            f"Created agent from Staff payroll ({agent.personal_number}, emp {employee_id})",
            entity_id=agent.pk,
        )
        return Response(
            {
                "success": True,
                "message": f"Agent created for {agent.personal_number} (username: {user.username})",
                "id": str(agent.pk),
                "service_id": agent.service_id,
                "username": user.username,
                "user_id": user.pk,
                "email": user.email,
                "phone": user.phone,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="search-hrm")
    def search_hrm(self, request):
        """HRM API + local agents lookup."""
        terms = parse_search_terms(request.query_params.get("search", ""))
        if not terms:
            return Response({"exists": False, "message": "Please provide an employee ID or phone."})

        if not hrm_configured():
            return Response({
                "exists": False,
                "configured": False,
                "message": "HRM is not configured. Set HRM_EMPLOYEE_TREE_URL, HRM_TOKEN, and HRM_USER_ID.",
            })

        hrm_list: list[dict] = []
        agents_list: list[dict] = []
        not_found = []
        seen_emp = set()
        seen_agent = set()
        hrm_error = None

        for term in terms:
            employees, err = fetch_hrm_employees(term)
            if err and not employees:
                hrm_error = err
            term_agents = list(_agents_matching_term(term)[:20])
            if not employees and not term_agents:
                not_found.append(term)
                continue
            for emp in employees:
                key = emp.get("employee_id") or emp.get("phone") or emp.get("name")
                if key in seen_emp:
                    continue
                seen_emp.add(key)
                hrm_list.append(emp)
            for agent in term_agents:
                if agent.pk in seen_agent:
                    continue
                seen_agent.add(agent.pk)
                agents_list.append(_agent_search_dict(agent))

        exists = bool(hrm_list or agents_list)
        return Response({
            "exists": exists,
            "configured": True,
            "message": (
                f"{len(hrm_list)} HRM + {len(agents_list)} agent(s)"
                if exists
                else (hrm_error or "No matches")
            ),
            "hrm_data": hrm_list,
            "agents_data": agents_list,
            "not_found_terms": not_found,
            "hrm_error": hrm_error,
            "searched_count": len(terms),
            "found_terms_count": len(terms) - len(not_found),
        })

    @action(detail=False, methods=["get"], url_path="eligible-users")
    def eligible_users(self, request):
        """Users that can become agents (no agent profile yet)."""
        qs = User.objects.filter(is_active=True, agent_profile__isnull=True).order_by(
            "first_name", "last_name", "email"
        )
        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(email__icontains=search)
                | Q(username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(phone__icontains=search)
            )
        data = [
            {
                "id": u.pk,
                "email": u.email,
                "username": u.username,
                "full_name": (u.get_full_name() or "").strip() or u.username,
                "phone": u.phone or "",
            }
            for u in qs[:50]
        ]
        return Response(data)

    @action(detail=True, methods=["get", "post"], url_path="access")
    def access_records(self, request, pk=None):
        return self._nested(request, pk, AgentAccess, AgentAccessSerializer, "access record")

    @action(detail=True, methods=["get", "post"], url_path="relatives")
    def relatives(self, request, pk=None):
        return self._nested(request, pk, AgentRelative, AgentRelativeSerializer, "relative")

    @action(
        detail=True,
        methods=["patch", "put", "delete"],
        url_path=r"relatives/(?P<relative_id>[^/.]+)",
    )
    def relative_detail(self, request, pk=None, relative_id=None):
        agent = self.get_object()
        try:
            relative = AgentRelative.objects.get(agent=agent, pk=relative_id)
        except AgentRelative.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "DELETE":
            relative.delete()
            self._audit_log(
                AuditTrail.EventType.DELETE,
                f"Removed relative for agent {agent.personal_number}",
                entity_id=agent.pk,
                details={"nested": "relative", "relative_id": relative_id},
            )
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = AgentRelativeSerializer(
            relative,
            data=request.data,
            partial=request.method == "PATCH",
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        self._audit_log(
            AuditTrail.EventType.UPDATE,
            f"Updated relative for agent {agent.personal_number}",
            entity_id=agent.pk,
            details={"nested": "relative", "relative_id": relative_id},
        )
        return Response(serializer.data)

    @action(detail=True, methods=["get", "post"], url_path="spouses")
    def spouses(self, request, pk=None):
        return self._nested(request, pk, AgentSpouse, AgentSpouseSerializer, "spouse")

    @action(detail=True, methods=["get", "post"], url_path="children")
    def children(self, request, pk=None):
        return self._nested(request, pk, AgentChild, AgentChildSerializer, "child")

    @action(detail=True, methods=["get", "post"], url_path="files")
    def files(self, request, pk=None):
        return self._nested(request, pk, AgentFile, AgentFileSerializer, "file")

    @action(detail=True, methods=["get"], url_path="captured-suspects")
    def captured_suspects(self, request, pk=None):
        """Suspects registered by this agent's linked user."""
        agent = self.get_object()
        if not agent.user_id:
            return Response({"count": 0, "results": []})
        qs = (
            Suspect.objects.filter(created_by_id=agent.user_id)
            .select_related("suspect_type")
            .order_by("-updated_at")
        )
        page = self.paginate_queryset(qs)
        serializer = SuspectListSerializer(
            page if page is not None else qs[:50],
            many=True,
            context={"request": request},
        )
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response({"count": qs.count(), "results": serializer.data})
