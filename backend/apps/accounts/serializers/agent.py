from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from apps.accounts.models import Agent, AgentAccess, AgentChild, AgentFile, AgentRelative, AgentSpouse, County, Department, Directorate, UserType
from apps.accounts.services.app_activity import activity_snapshot, relative_activity_label
from apps.suspects.photo_utils import resolve_photo_url

User = get_user_model()


class AgentListSerializer(serializers.ModelSerializer):
    personal_number = serializers.CharField(read_only=True)
    county_name = serializers.CharField(source="county.name", read_only=True, default=None)
    directorate_name = serializers.CharField(source="directorate.name", read_only=True, default=None)
    user_id = serializers.IntegerField(read_only=True, allow_null=True)
    user_email = serializers.SerializerMethodField()
    user_username = serializers.SerializerMethodField()
    user_is_active = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()
    profile_url = serializers.SerializerMethodField()

    class Meta:
        model = Agent
        fields = (
            "id",
            "user_id",
            "user_email",
            "user_username",
            "user_is_active",
            "user_role",
            "profile_url",
            "service_id",
            "personal_number",
            "first_name",
            "father_name",
            "last_name",
            "phone",
            "email",
            "status",
            "present",
            "county",
            "county_name",
            "directorate",
            "directorate_name",
            "created_at",
        )

    def get_user_email(self, obj) -> str | None:
        return obj.user.email if obj.user_id else None

    def get_user_username(self, obj) -> str | None:
        return obj.user.username if obj.user_id else None

    def get_user_is_active(self, obj) -> bool:
        return bool(obj.user and obj.user.is_active and not getattr(obj.user, "suspend", False))

    def get_user_role(self, obj) -> str:
        if not obj.user_id:
            return "agent"
        return getattr(obj.user, "role", None) or "agent"

    def get_profile_url(self, obj) -> str | None:
        photo = obj.profile
        if (not photo or not getattr(photo, "name", None)) and obj.user_id:
            user_photo = getattr(obj.user, "profile", None)
            if user_photo and getattr(user_photo, "name", None):
                photo = user_photo
        if not photo or not getattr(photo, "name", None):
            return None
        url = resolve_photo_url(photo.name, self.context.get("request"))
        return url or None


class AgentAppUserSerializer(AgentListSerializer):
    """Lean list row for Amniga Isticmalaayasha (app account admin)."""

    nickname = serializers.CharField(read_only=True, allow_null=True)
    full_name = serializers.SerializerMethodField()
    password_changed = serializers.SerializerMethodField()
    has_app_pin = serializers.SerializerMethodField()
    app_pin_changed = serializers.SerializerMethodField()
    last_login = serializers.SerializerMethodField()
    last_login_relative = serializers.SerializerMethodField()
    days_since_login = serializers.SerializerMethodField()
    activity_status = serializers.SerializerMethodField()
    inactive_days = serializers.SerializerMethodField()
    groups = serializers.SerializerMethodField()
    user_suspend = serializers.SerializerMethodField()
    user_type_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    app_installed = serializers.SerializerMethodField()
    installation_status = serializers.SerializerMethodField()
    installation_label = serializers.SerializerMethodField()
    not_installed_reason = serializers.SerializerMethodField()
    not_installed_reason_label = serializers.SerializerMethodField()
    not_installed_reason_detail = serializers.SerializerMethodField()
    installed_at = serializers.SerializerMethodField()

    class Meta(AgentListSerializer.Meta):
        fields = AgentListSerializer.Meta.fields + (
            "nickname",
            "full_name",
            "password_changed",
            "has_app_pin",
            "app_pin_changed",
            "last_login",
            "last_login_relative",
            "days_since_login",
            "activity_status",
            "inactive_days",
            "groups",
            "user_suspend",
            "user_type_name",
            "department_name",
            "app_installed",
            "installation_status",
            "installation_label",
            "not_installed_reason",
            "not_installed_reason_label",
            "not_installed_reason_detail",
            "installed_at",
        )

    def get_full_name(self, obj) -> str:
        parts = [obj.first_name, obj.father_name, obj.last_name, getattr(obj, "fourth_name", "") or ""]
        name = " ".join(p for p in parts if p).strip()
        return name or (obj.personal_number or "")

    def get_password_changed(self, obj) -> bool:
        return bool(obj.user and obj.user.password_changed)

    def get_has_app_pin(self, obj) -> bool:
        return bool(obj.user and obj.user.app_pin)

    def get_app_pin_changed(self, obj) -> bool:
        return bool(obj.user and obj.user.app_pin_changed)

    def get_last_login(self, obj) -> str | None:
        last_activity = getattr(obj, "last_app_activity", None)
        if not last_activity:
            return None
        return last_activity.isoformat()

    def get_days_since_login(self, obj) -> int | None:
        return activity_snapshot(getattr(obj, "last_app_activity", None))["inactive_days"]

    def get_last_login_relative(self, obj) -> str:
        return relative_activity_label(getattr(obj, "last_app_activity", None))

    def get_activity_status(self, obj) -> str:
        return activity_snapshot(getattr(obj, "last_app_activity", None))["status"]

    def get_inactive_days(self, obj) -> int | None:
        return activity_snapshot(getattr(obj, "last_app_activity", None))["inactive_days"]

    def get_groups(self, obj) -> list[dict]:
        if not obj.user_id:
            return []
        # Prefetched via Prefetch('user__groups')
        return [{"id": g.id, "name": g.name} for g in obj.user.groups.all()]

    def get_user_suspend(self, obj) -> bool:
        return bool(obj.user and getattr(obj.user, "suspend", False))

    def get_user_type_name(self, obj) -> str | None:
        user_type = getattr(obj.user, "user_type", None) if obj.user_id else None
        return user_type.name if user_type else None

    def get_department_name(self, obj) -> str | None:
        department = getattr(obj.user, "department", None) if obj.user_id else None
        return department.name if department else None

    def _installation(self, obj):
        if not obj.user_id:
            return None
        return getattr(obj.user, "app_installation", None)

    def get_app_installed(self, obj) -> bool:
        return self.get_installation_status(obj) == "completed"

    def get_installation_status(self, obj) -> str:
        installation = self._installation(obj)
        return installation.status if installation else "not_installed"

    def get_installation_label(self, obj) -> str:
        return {
            "completed": "Loogu shubay",
            "iphone": "iPhone",
            "not_installed": "Looguma shubin",
        }[self.get_installation_status(obj)]

    def get_not_installed_reason(self, obj) -> str:
        installation = self._installation(obj)
        return installation.not_installed_reason if installation else ""

    def get_not_installed_reason_label(self, obj) -> str:
        installation = self._installation(obj)
        if not installation or not installation.not_installed_reason:
            return ""
        return installation.get_not_installed_reason_display()

    def get_not_installed_reason_detail(self, obj) -> str:
        installation = self._installation(obj)
        return installation.not_installed_reason_detail if installation else ""

    def get_installed_at(self, obj) -> str | None:
        installation = self._installation(obj)
        if not installation or not installation.installed_at:
            return None
        return installation.installed_at.isoformat()

    def get_user_email(self, obj) -> str | None:
        return obj.user.email if obj.user_id else None

    def get_user_username(self, obj) -> str | None:
        return obj.user.username if obj.user_id else None

    def get_user_is_active(self, obj) -> bool:
        return bool(obj.user and obj.user.is_active and not getattr(obj.user, "suspend", False))

    def get_user_role(self, obj) -> str:
        if not obj.user_id:
            return "agent"
        return getattr(obj.user, "role", None) or "agent"

    def get_profile_url(self, obj) -> str | None:
        # Prefer agent photo; fall back to linked user's profile photo.
        # Legacy paths (uploads/agents/, avatars/) live on S3 — same as old NISA.
        photo = obj.profile
        if (not photo or not getattr(photo, "name", None)) and obj.user_id:
            user_photo = getattr(obj.user, "profile", None)
            if user_photo and getattr(user_photo, "name", None):
                photo = user_photo
        if not photo or not getattr(photo, "name", None):
            return None
        url = resolve_photo_url(photo.name, self.context.get("request"))
        return url or None


class AgentDetailSerializer(AgentListSerializer):
    user_location = serializers.SerializerMethodField()
    access_count = serializers.IntegerField(read_only=True)
    relatives_count = serializers.IntegerField(read_only=True)
    files_count = serializers.IntegerField(read_only=True)
    captured_suspects_count = serializers.IntegerField(read_only=True, default=0)
    user_type = serializers.SerializerMethodField()
    user_type_name = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()

    class Meta(AgentListSerializer.Meta):
        fields = AgentListSerializer.Meta.fields + (
            "fourth_name",
            "mother_name",
            "nickname",
            "date_of_birth",
            "gender",
            "biography",
            "weapon_name",
            "serial_number",
            "tribe_name",
            "region_name",
            "sub_county_name",
            "section_name",
            "user_type",
            "user_type_name",
            "department",
            "department_name",
            "user_location",
            "access_count",
            "relatives_count",
            "files_count",
            "captured_suspects_count",
            "updated_at",
        )

    def get_user_type(self, obj) -> int | None:
        return obj.user.user_type_id if obj.user_id else None

    def get_user_type_name(self, obj) -> str | None:
        ut = getattr(obj.user, "user_type", None) if obj.user_id else None
        return ut.name if ut else None

    def get_department(self, obj) -> int | None:
        return obj.user.department_id if obj.user_id else None

    def get_department_name(self, obj) -> str | None:
        dept = getattr(obj.user, "department", None) if obj.user_id else None
        return dept.name if dept else None

    def get_user_location(self, obj) -> dict:
        user = obj.user
        if not user:
            return {
                "latitude": "",
                "longitude": "",
                "location": "",
                "county_name": None,
            }
        lat = (user.latitude or "").strip()
        lng = (user.longitude or "").strip()
        if not lat or lat in {"0", "0.0"} or not lng or lng in {"0", "0.0"}:
            latest = (
                user.location_history.exclude(latitude=None)
                .exclude(longitude=None)
                .order_by("-last_updated")
                .only("latitude", "longitude")
                .first()
            )
            if latest and latest.latitude is not None and latest.longitude is not None:
                lat = str(latest.latitude)
                lng = str(latest.longitude)
        return {
            "latitude": lat,
            "longitude": lng,
            "location": user.location or "",
            "county_name": user.county.name if user.county_id else None,
        }


class AgentWriteSerializer(serializers.ModelSerializer):
    """Every agent must be linked to a user account (existing or created here)."""

    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
    )
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=8)
    username = serializers.CharField(write_only=True, required=False, allow_blank=True)
    user_type = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    department = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Agent
        fields = (
            "user",
            "password",
            "username",
            "user_type",
            "department",
            "service_id",
            "first_name",
            "father_name",
            "last_name",
            "fourth_name",
            "mother_name",
            "nickname",
            "date_of_birth",
            "gender",
            "phone",
            "email",
            "status",
            "present",
            "profile",
            "biography",
            "weapon_name",
            "serial_number",
            "tribe_name",
            "region_name",
            "county",
            "sub_county_name",
            "section_name",
            "directorate",
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance is not None:
            return attrs

        user = attrs.get("user")
        password = (attrs.get("password") or "").strip()
        email = (attrs.get("email") or "").strip()

        if user is not None:
            if Agent.objects.filter(user=user).exists():
                raise serializers.ValidationError(
                    {"user": "This user is already linked to an agent profile."}
                )
            return attrs

        if not email:
            raise serializers.ValidationError(
                {"email": "Email is required when creating a new user for this agent."}
            )
        if not password:
            raise serializers.ValidationError(
                {"password": "Password is required when creating a new user for this agent."}
            )
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                {"email": "A user with this email already exists. Link that user instead."}
            )
        attrs["email"] = email
        attrs["password"] = password
        return attrs

    def _unique_username(self, base: str) -> str:
        base = (base or "agent").strip()[:40] or "agent"
        candidate = base
        n = 1
        while User.objects.filter(username=candidate).exists():
            n += 1
            candidate = f"{base}{n}"[:50]
        return candidate

    @staticmethod
    def _sync_linked_user(
        user,
        *,
        county=None,
        phone=None,
        profile=None,
        is_agent=True,
        user_type_id=serializers.empty,
        department_id=serializers.empty,
    ):
        """Keep the login user in sync — users list reads User.county / User.profile."""
        if not user:
            return
        updates: list[str] = []
        if is_agent and not user.is_agent:
            user.is_agent = True
            updates.append("is_agent")
        if county is not None and user.county_id != getattr(county, "pk", county):
            user.county = county
            updates.append("county")
        if phone is not None and phone and user.phone != phone:
            user.phone = phone
            updates.append("phone")
        if profile is not None:
            user.profile = profile
            updates.append("profile")
        if user_type_id is not serializers.empty:
            new_type_id = None if user_type_id in (None, "") else int(user_type_id)
            if new_type_id is not None and not UserType.objects.filter(pk=new_type_id).exists():
                raise serializers.ValidationError({"user_type": "User type lama helin."})
            if user.user_type_id != new_type_id:
                user.user_type_id = new_type_id
                updates.append("user_type")
        if department_id is not serializers.empty:
            new_dept_id = None if department_id in (None, "") else int(department_id)
            if new_dept_id is not None and not Department.objects.filter(pk=new_dept_id).exists():
                raise serializers.ValidationError({"department": "Qeyb lama helin."})
            if user.department_id != new_dept_id:
                user.department_id = new_dept_id
                updates.append("department")
        if updates:
            user.save(update_fields=updates)

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password", None)
        username = (validated_data.pop("username", None) or "").strip()
        user = validated_data.pop("user", None)
        user_type_id = validated_data.pop("user_type", serializers.empty)
        department_id = validated_data.pop("department", serializers.empty)
        county = validated_data.get("county")
        phone = validated_data.get("phone") or ""

        if user is None:
            email = validated_data["email"]
            username = self._unique_username(username or email.split("@")[0])
            user = User.objects.create_user(
                email=email,
                username=username,
                password=password,
                first_name=validated_data.get("first_name", "")[:50],
                last_name=validated_data.get("last_name", "")[:50],
                phone=phone,
                is_agent=True,
                is_active=True,
                county=county,
            )
            self._sync_linked_user(
                user,
                user_type_id=user_type_id,
                department_id=department_id,
            )
        else:
            self._sync_linked_user(
                user,
                county=county,
                phone=phone,
                is_agent=True,
                user_type_id=user_type_id,
                department_id=department_id,
            )

        validated_data["user"] = user
        validated_data["recorded_by"] = self.context["request"].user
        if not validated_data.get("email") and user.email:
            validated_data["email"] = user.email
        agent = super().create(validated_data)
        # Profile may be set on create via multipart.
        if agent.profile:
            self._sync_linked_user(agent.user, profile=agent.profile)
        return agent

    @transaction.atomic
    def update(self, instance, validated_data):
        validated_data.pop("password", None)
        validated_data.pop("username", None)
        user_type_id = validated_data.pop("user_type", serializers.empty)
        department_id = validated_data.pop("department", serializers.empty)
        # Keep existing user link; do not allow clearing it.
        if "user" in validated_data and validated_data["user"] is None:
            validated_data.pop("user")
        elif "user" in validated_data and validated_data["user"] != instance.user:
            new_user = validated_data["user"]
            if Agent.objects.filter(user=new_user).exclude(pk=instance.pk).exists():
                raise serializers.ValidationError(
                    {"user": "This user is already linked to an agent profile."}
                )
            if instance.user_id and instance.user_id != new_user.pk:
                old = instance.user
                if old and not Agent.objects.filter(user=old).exclude(pk=instance.pk).exists():
                    old.is_agent = False
                    old.save(update_fields=["is_agent"])
            new_user.is_agent = True
            new_user.save(update_fields=["is_agent"])
        agent = super().update(instance, validated_data)
        sync_kwargs = {
            "county": agent.county,
            "phone": agent.phone or "",
            "is_agent": True,
            "user_type_id": user_type_id,
            "department_id": department_id,
        }
        if "profile" in validated_data:
            sync_kwargs["profile"] = agent.profile
        self._sync_linked_user(agent.user, **sync_kwargs)
        return agent


class AgentAccessSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentAccess
        fields = (
            "id",
            "reference_number",
            "access_location",
            "relationship_type",
            "joined_at",
            "training",
            "training_location",
            "role_held",
            "occupation",
            "referrer_name",
            "referrer_phone",
            "referrer_email",
            "referrer_role",
            "notes",
            "created_at",
        )
        read_only_fields = ("id", "created_at")

    def create(self, validated_data):
        validated_data["recorded_by"] = self.context["request"].user
        return super().create(validated_data)


class AgentRelativeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentRelative
        fields = ("id", "full_name", "relationship", "district", "phone", "description", "created_at")
        read_only_fields = ("id", "created_at")

    def create(self, validated_data):
        validated_data["recorded_by"] = self.context["request"].user
        return super().create(validated_data)


class AgentSpouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentSpouse
        fields = (
            "id",
            "marital_status",
            "full_name",
            "mother_name",
            "phone",
            "marriage_date",
            "marriage_place",
            "tribe",
            "photo",
            "created_at",
        )
        read_only_fields = ("id", "created_at")

    def create(self, validated_data):
        validated_data["recorded_by"] = self.context["request"].user
        return super().create(validated_data)


class AgentChildSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentChild
        fields = (
            "id",
            "first_name",
            "father_name",
            "date_of_birth",
            "place_of_birth",
            "phone",
            "gender",
            "mother_name",
            "photo",
            "created_at",
        )
        read_only_fields = ("id", "created_at")

    def create(self, validated_data):
        validated_data["recorded_by"] = self.context["request"].user
        return super().create(validated_data)


class AgentFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = AgentFile
        fields = ("id", "file_name", "file", "file_code", "file_url", "created_at")
        read_only_fields = ("id", "file_code", "created_at")

    def get_file_url(self, obj) -> str | None:
        if not obj.file or not getattr(obj.file, "name", None):
            return None
        url = resolve_photo_url(obj.file.name, self.context.get("request"))
        return url or None

    def create(self, validated_data):
        validated_data["recorded_by"] = self.context["request"].user
        return super().create(validated_data)
