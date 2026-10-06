from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.cache import cache
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import County, Department, Directorate, Region, Relationship, SubCounty, UserType
from apps.accounts.permissions import (
    GroupPermission,
    IsActiveUser,
    IsAdminUser,
    PermissionCatalogPermission,
    UserPermission,
)
from apps.audit.mixins import AuditedViewSetMixin
from apps.audit.models import AuditTrail
from apps.accounts.serializers.actions import (
    AdminResetPasswordSerializer,
    AdminResetPinSerializer,
    AssignGroupsSerializer,
    MobileLoginTestSerializer,
)
User = get_user_model()


def _phone_password_candidates(user) -> list[str]:
    raw = (getattr(user, "phone", None) or "").strip()
    if not raw:
        agent = getattr(user, "agent_profile", None)
        raw = (getattr(agent, "phone", None) or "").strip()
    if not raw:
        return []
    digits = "".join(ch for ch in raw if ch.isdigit())
    out: list[str] = []
    for item in (raw.replace(" ", ""), digits, digits.lstrip("0") if digits else ""):
        if item and item not in out:
            out.append(item)
    return out


def _mobile_login_probe(user) -> dict:
    from apps.accounts.views.mobile_auth import _resolve_login_user

    email = (user.email or "").strip()
    agent = getattr(user, "agent_profile", None)
    nickname = (getattr(agent, "nickname", None) or "").strip()
    last4 = nickname[-4:] if len(nickname) >= 4 and nickname[-4:].isdigit() else ""
    password = ""
    for candidate in _phone_password_candidates(user):
        if user.check_password(candidate):
            password = candidate
            break
    locked = bool(user.lock_until and user.lock_until > timezone.now())
    eligible = bool(user.is_mobile or user.is_agent)
    account_ok = bool(user.is_active and not user.suspend and not locked and eligible)
    email_ok = bool(password and email and user.check_password(password))
    resolved = _resolve_login_user(last4) if last4 else None
    last4_ok = bool(resolved and resolved.pk == user.pk and email_ok)
    can_login = bool(account_ok and last4_ok)
    if not eligible:
        detail = "Ma aha agent/mobile"
    elif not user.is_active or user.suspend or locked:
        detail = "Account-ka waa xiran / aan firfircoonayn"
    elif not last4:
        detail = "EMP / nickname ma dhammaado 4 lambar"
    elif resolved is None:
        detail = "4-digit ma xirmo (duplicate ama ma jiro)"
    elif resolved.pk != user.pk:
        detail = "4-digit wuxuu xiray user kale"
    elif not password:
        detail = "Password ma aha phone — lama tijaabin karin"
    elif can_login:
        detail = "OK"
    else:
        detail = "Mobile login ma shaqayn"
    return {
        "user_id": user.pk,
        "name": user.get_full_name() or user.username,
        "email": email,
        "last4": last4,
        "nickname": nickname,
        "password": password,
        "password_is_phone": bool(password),
        "last4_ok": last4_ok,
        "email_ok": email_ok,
        "can_login": can_login,
        "detail": detail,
    }


from apps.accounts.serializers.lookup import (
    CountySerializer,
    DepartmentSerializer,
    DirectorateSerializer,
    RegionSerializer,
    RelationshipSerializer,
    SubCountySerializer,
    UserTypeSerializer,
)
from apps.accounts.serializers.rbac import (
    GroupCreateSerializer,
    GroupDetailSerializer,
    GroupListSerializer,
    GroupUpdateSerializer,
    PermissionSerializer,
)
from apps.accounts.serializers.user import (
    UserCreateSerializer,
    UserDetailSerializer,
    UserListSerializer,
    UserStatusSerializer,
    UserUpdateSerializer,
)
from apps.accounts.services.permission_assignments import (
    build_permission_assignments_payload,
    build_permission_holders,
)
from apps.accounts.services.usercontrol_dashboard import build_usercontrol_dashboard
from apps.core.cache import (
    LONG,
    MEDIUM,
    PERMISSION_ASSIGNMENTS_CACHE_KEY,
    cache_response,
    invalidate_permission_assignments_cache,
    invalidate_user_cache,
    invalidate_users_stats_cache,
)


class AccountsPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class AccountsLargePagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = "page_size"
    max_page_size = 2000


class UserViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    audit_module = "usercontrol"
    audit_entity = "user"
    permission_classes = [IsAuthenticated, IsActiveUser, UserPermission]
    pagination_class = AccountsPagination
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    search_fields = ["email", "username", "first_name", "last_name", "phone"]
    ordering_fields = ["date_joined", "email", "username"]
    ordering = ["-date_joined"]

    def get_queryset(self):
        qs = User.objects.select_related(
            "user_type", "directorate", "department", "county", "agent_profile"
        )
        if self.action in ("retrieve", "assign_groups", "check_staff", "devices"):
            qs = qs.prefetch_related("groups", "user_permissions__content_type", "devices")
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(email__icontains=search)
                | Q(username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(agent_profile__service_id__icontains=search)
            )
        for field in ("is_active", "is_admin", "is_officer", "is_agent", "suspend"):
            value = self.request.query_params.get(field)
            if value is not None and value != "":
                qs = qs.filter(**{field: value.lower() in ("true", "1", "yes")})
        county = self.request.query_params.get("county")
        if county:
            qs = qs.filter(county_id=county)
        is_staff = self.request.query_params.get("is_staff")
        if is_staff is not None and is_staff != "":
            qs = qs.filter(is_staff=is_staff.lower() in ("true", "1", "yes"))
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ("update", "partial_update"):
            return UserUpdateSerializer
        if self.action == "retrieve":
            return UserDetailSerializer
        if self.action == "status":
            return UserStatusSerializer
        return UserListSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        invalidate_user_cache(user.pk)
        invalidate_permission_assignments_cache()
        invalidate_users_stats_cache()
        self._audit_log(
            AuditTrail.EventType.CREATE,
            f"Created user {user.email}",
            entity_id=user.pk,
            details={"email": user.email},
        )
        return Response(
            UserDetailSerializer(user, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        invalidate_user_cache(user.pk)
        invalidate_permission_assignments_cache()
        invalidate_users_stats_cache()
        self._audit_log(
            AuditTrail.EventType.UPDATE,
            f"Updated user {user.email}",
            entity_id=user.pk,
        )
        return Response(UserDetailSerializer(user, context={"request": request}).data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def perform_update(self, serializer):
        user = serializer.save()
        invalidate_user_cache(user.pk)

    def perform_destroy(self, instance):
        self._audit_log(
            AuditTrail.EventType.DELETE,
            f"Deleted user {instance.email}",
            entity_id=instance.pk,
        )
        pk = instance.pk
        instance.delete()
        invalidate_user_cache(pk)
        invalidate_permission_assignments_cache()
        invalidate_users_stats_cache()

    @action(detail=True, methods=["post", "patch"])
    def status(self, request, pk=None):
        user = self.get_object()
        serializer = UserStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(user, field, value)
        user.save(update_fields=list(serializer.validated_data.keys()))
        invalidate_user_cache(user.pk)
        invalidate_users_stats_cache()
        self._audit_log(
            AuditTrail.EventType.UPDATE,
            f"Changed status for user {user.email}",
            entity_id=user.pk,
            details=serializer.validated_data,
        )
        return Response(UserDetailSerializer(user).data)

    @action(detail=False, methods=["get"])
    @cache_response(timeout=MEDIUM, key_prefix="users.stats")
    def stats(self, request):
        agg = User.objects.aggregate(
            total=Count("id"),
            active=Count("id", filter=Q(is_active=True, suspend=False)),
            suspended=Count("id", filter=Q(suspend=True)),
            admins=Count("id", filter=Q(is_admin=True)),
            staff=Count("id", filter=Q(is_staff=True)),
            mobile=Count("id", filter=Q(is_mobile=True)),
        )
        return Response(agg)

    @action(detail=False, methods=["get"])
    @cache_response(timeout=MEDIUM, key_prefix="users.dashboard")
    def dashboard(self, request):
        """Rich User Control dashboard payload (users, audit, roles, activity)."""
        return Response(build_usercontrol_dashboard())

    @action(detail=True, methods=["get"])
    def check_staff(self, request, pk=None):
        user = self.get_object()
        return Response(
            {
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
                "is_admin": user.is_admin,
                "is_officer": user.is_officer,
                "is_agent": user.is_agent,
                "is_active": user.is_active,
                "suspend": user.suspend,
                "can_access_admin": user.is_staff or user.is_superuser,
                "role": user.role,
            }
        )

    @action(detail=True, methods=["post"])
    def test_mobile_login(self, request, pk=None):
        """Test mobile login with email + phone-as-password (legacy C.I.Sh behaviour)."""
        user = self.get_object()
        serializer = MobileLoginTestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        password = (serializer.validated_data.get("password") or "").replace(" ", "").strip()
        if not password:
            password = (user.phone or "").replace(" ", "").strip()
        email = (user.email or "").replace(" ", "").strip()
        auth_ok = bool(password and email and authenticate(username=email, password=password))
        locked = user.lock_until and user.lock_until > timezone.now()
        can_login = (
            (user.is_mobile or user.is_agent)
            and user.is_active
            and not user.suspend
            and not locked
            and auth_ok
        )
        payload = {
            "eligible": user.is_mobile or user.is_agent,
            "is_mobile": user.is_mobile,
            "password_ok": auth_ok,
            "is_active": user.is_active,
            "suspend": user.suspend,
            "locked": locked,
            "login_attempts": user.login_attempts,
            "can_login": can_login,
            "tested_with": {
                "email": email,
                "password": password,
            },
        }
        if not password:
            payload["detail"] = "User has no phone number on file; cannot test mobile login."
        return Response(payload)

    @action(detail=False, methods=["post"], url_path="test_mobile_logins")
    def test_mobile_logins(self, request):
        """Batch-test last-4 + email mobile login for selected App Users."""
        raw_ids = request.data.get("user_ids") or []
        try:
            user_ids = [int(uid) for uid in raw_ids]
        except (TypeError, ValueError):
            return Response(
                {"detail": "user_ids waa inay tiro yihiin."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user_ids:
            return Response(
                {"detail": "Dooro ugu yaraan hal user."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(user_ids) > 80:
            return Response(
                {"detail": "Ugu badnaan 80 user hal mar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        users = list(
            User.objects.filter(pk__in=user_ids, is_superuser=False).select_related(
                "agent_profile"
            )
        )
        by_id = {user.pk: user for user in users}
        results = []
        ok_count = 0
        for user_id in user_ids:
            user = by_id.get(user_id)
            if not user:
                results.append(
                    {
                        "user_id": user_id,
                        "name": "",
                        "email": "",
                        "last4": "",
                        "password": "",
                        "password_is_phone": False,
                        "last4_ok": False,
                        "email_ok": False,
                        "can_login": False,
                        "detail": "User lama helin",
                    }
                )
                continue
            row = _mobile_login_probe(user)
            if row["can_login"]:
                ok_count += 1
            results.append(row)
        return Response({"results": results, "ok": ok_count, "total": len(results)})

    @action(detail=True, methods=["post", "patch"])
    def assign_groups(self, request, pk=None):
        user = self.get_object()
        serializer = AssignGroupsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        groups = serializer.validated_data["group_ids"]
        user.groups.set(groups)
        assigned_group_ids = [group.pk for group in groups]
        invalidate_user_cache(user.pk)
        invalidate_permission_assignments_cache()
        self._audit_log(
            AuditTrail.EventType.UPDATE,
            f"Assigned groups to user {user.email}",
            entity_id=user.pk,
            details={"group_ids": assigned_group_ids},
        )
        return Response(UserDetailSerializer(user, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        serializer = AdminResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data["new_password"])
        user.password_changed = True
        user.save(update_fields=["password", "password_changed"])
        invalidate_user_cache(user.pk)
        self._audit_log(
            AuditTrail.EventType.UPDATE,
            f"Admin reset password for {user.email}",
            entity_id=user.pk,
        )
        return Response({"detail": "Password reset successfully."})

    @action(detail=True, methods=["post"])
    def reset_pin(self, request, pk=None):
        from django.contrib.auth.hashers import make_password

        user = self.get_object()
        serializer = AdminResetPinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pin = serializer.validated_data["new_pin"]
        user.app_pin = make_password(pin)
        # Default "0000" matches v2 list reset — user should change PIN on next use.
        user.app_pin_changed = pin != "0000"
        user.save(update_fields=["app_pin", "app_pin_changed"])
        invalidate_user_cache(user.pk)
        self._audit_log(
            AuditTrail.EventType.UPDATE,
            f"Admin reset PIN for {user.email}",
            entity_id=user.pk,
        )
        return Response({"detail": "PIN reset successfully."})

    @action(detail=True, methods=["get"])
    def devices(self, request, pk=None):
        user = self.get_object()
        rows = user.devices.order_by("-created_at")[:20]
        data = [
            {
                "id": str(d.id),
                "device": d.device,
                "action": d.action,
                "ip_address": d.ip_address,
                "operating_system": d.operating_system,
                "browser": d.browser,
                "created_at": d.created_at,
            }
            for d in rows
        ]
        return Response(data)


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.select_related("content_type").order_by(
        "content_type__app_label", "content_type__model", "codename"
    )
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, IsActiveUser, PermissionCatalogPermission]
    pagination_class = AccountsLargePagination

    @cache_response(timeout=LONG, key_prefix="permissions.list")
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(codename__icontains=search)
                | Q(content_type__app_label__icontains=search)
                | Q(content_type__model__icontains=search)
            )
        return qs


class GroupViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    audit_module = "usercontrol"
    audit_entity = "group"
    queryset = (
        Group.objects.annotate(_permission_count=Count("permissions", distinct=True))
        .prefetch_related("permissions__content_type")
        .order_by("name")
    )
    permission_classes = [IsAuthenticated, IsActiveUser, GroupPermission]
    pagination_class = AccountsPagination

    def get_serializer_class(self):
        if self.action == "create":
            return GroupCreateSerializer
        if self.action in ("update", "partial_update"):
            return GroupUpdateSerializer
        if self.action == "retrieve":
            return GroupDetailSerializer
        return GroupListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(name__icontains=search)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        group = serializer.instance
        return Response(
            GroupDetailSerializer(group, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        group = serializer.instance
        return Response(GroupDetailSerializer(group, context={"request": request}).data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save()
        invalidate_permission_assignments_cache()

    def perform_destroy(self, instance):
        instance.delete()
        invalidate_permission_assignments_cache()

    def perform_update(self, serializer):
        group = serializer.save()
        member_ids = list(group.user_set.values_list("pk", flat=True))
        for uid in member_ids:
            invalidate_user_cache(uid)
        invalidate_permission_assignments_cache()

    @action(detail=False, methods=["get"], url_path="permission-assignments")
    def permission_assignments(self, request):
        """Groups, users, and holder counts. Full holder lists are lazy-loaded."""
        include_holders = request.query_params.get("include_holders") == "1"
        cache_key = (
            PERMISSION_ASSIGNMENTS_CACHE_KEY
            if not include_holders
            else f"{PERMISSION_ASSIGNMENTS_CACHE_KEY}:full"
        )
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        payload = build_permission_assignments_payload(include_holders=include_holders)
        cache.set(cache_key, payload, MEDIUM)
        return Response(payload)

    @action(detail=False, methods=["get"], url_path="permission-holders")
    def permission_holders(self, request):
        raw = request.query_params.get("permission_id", "").strip()
        if not raw.isdigit():
            return Response(
                {"detail": "permission_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        holders = build_permission_holders(int(raw))
        return Response({"holders": holders})


class LookupViewSetMixin:
    permission_classes = [IsAuthenticated, IsActiveUser]
    pagination_class = AccountsPagination

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search", "").strip()
        if search and hasattr(self.queryset.model, "name"):
            qs = qs.filter(name__icontains=search)
        return qs


class UserTypeViewSet(LookupViewSetMixin, viewsets.ModelViewSet):
    queryset = UserType.objects.order_by("name")
    serializer_class = UserTypeSerializer
    pagination_class = AccountsLargePagination


class DirectorateViewSet(LookupViewSetMixin, viewsets.ModelViewSet):
    queryset = Directorate.objects.all()
    serializer_class = DirectorateSerializer
    permission_classes = [IsAuthenticated, IsActiveUser, IsAdminUser]


class DepartmentViewSet(LookupViewSetMixin, viewsets.ModelViewSet):
    queryset = Department.objects.prefetch_related("counties").order_by("name")
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, IsActiveUser, UserPermission]
    pagination_class = AccountsLargePagination


class CountyViewSet(LookupViewSetMixin, viewsets.ModelViewSet):
    queryset = County.objects.select_related("region").order_by("name")
    serializer_class = CountySerializer
    pagination_class = AccountsLargePagination

    def get_queryset(self):
        qs = super().get_queryset()
        region = self.request.query_params.get("region")
        if region:
            qs = qs.filter(region_id=region)
        return qs


class RegionViewSet(LookupViewSetMixin, viewsets.ModelViewSet):
    queryset = Region.objects.order_by("name")
    serializer_class = RegionSerializer


class SubCountyViewSet(LookupViewSetMixin, viewsets.ModelViewSet):
    queryset = SubCounty.objects.select_related("county", "county__region").order_by("name")
    serializer_class = SubCountySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        county = self.request.query_params.get("county")
        if county:
            qs = qs.filter(county_id=county)
        return qs


class RelationshipViewSet(LookupViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Relationship.objects.order_by("id")
    serializer_class = RelationshipSerializer
