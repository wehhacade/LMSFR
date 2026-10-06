from django.contrib.auth.models import Group, Permission
from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.serializers.rbac import PermissionSerializer
from apps.suspects.photo_utils import resolve_photo_url


def user_profile_photo_url(obj: User, request=None) -> str | None:
    """User avatar, falling back to linked agent photo when present."""
    photo = obj.profile if obj.profile and getattr(obj.profile, "name", None) else None
    if not photo:
        agent = getattr(obj, "agent_profile", None)
        if agent is not None and agent.profile and getattr(agent.profile, "name", None):
            photo = agent.profile
    if not photo or not getattr(photo, "name", None):
        return None
    url = resolve_photo_url(photo.name, request)
    return url or None


class GroupSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ("id", "name")


class UserListSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    role = serializers.CharField(read_only=True)
    county_name = serializers.CharField(source="county.name", read_only=True, default=None)
    profile_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "county",
            "county_name",
            "profile_url",
            "is_active",
            "is_staff",
            "is_mobile",
            "is_admin",
            "is_officer",
            "is_agent",
            "suspend",
            "role",
            "date_joined",
        )

    def get_full_name(self, obj: User) -> str:
        return obj.get_full_name() or obj.email

    def get_profile_url(self, obj: User) -> str | None:
        return user_profile_photo_url(obj, self.context.get("request"))


class UserDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    role = serializers.CharField(read_only=True)
    profile_url = serializers.SerializerMethodField()
    groups = GroupSummarySerializer(many=True, read_only=True)
    permissions = serializers.SerializerMethodField()
    directorate_name = serializers.CharField(source="directorate.name", read_only=True, default=None)
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)
    county_name = serializers.CharField(source="county.name", read_only=True, default=None)
    user_type_name = serializers.CharField(source="user_type.name", read_only=True, default=None)
    group_ids = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(),
        source="groups",
        many=True,
        write_only=True,
        required=False,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "gender",
            "bio",
            "profile_url",
            "is_staff",
            "is_superuser",
            "is_mobile",
            "is_admin",
            "is_officer",
            "is_agent",
            "is_active",
            "is_staff",
            "is_mobile",
            "suspend",
            "password_changed",
            "app_pin_changed",
            "role",
            "directorate",
            "directorate_name",
            "department",
            "department_name",
            "county",
            "county_name",
            "user_type",
            "user_type_name",
            "mobile_type",
            "last_login_device",
            "groups",
            "group_ids",
            "permissions",
            "date_joined",
            "last_login",
        )
        read_only_fields = ("id", "date_joined", "last_login", "password_changed", "app_pin_changed")

    def get_full_name(self, obj: User) -> str:
        return obj.get_full_name() or obj.email

    def get_profile_url(self, obj: User) -> str | None:
        return user_profile_photo_url(obj, self.context.get("request"))

    def get_permissions(self, obj: User) -> list[dict]:
        if hasattr(obj, "_prefetched_objects_cache") and "user_permissions" in obj._prefetched_objects_cache:
            perms = obj.user_permissions.all()
        else:
            perms = obj.user_permissions.select_related("content_type").all()
        return PermissionSerializer(perms, many=True).data


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    profile = serializers.FileField(required=False, allow_null=True)
    group_ids = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(),
        source="groups",
        many=True,
        required=False,
    )
    permission_ids = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(),
        source="user_permissions",
        many=True,
        required=False,
    )

    class Meta:
        model = User
        fields = (
            "email",
            "username",
            "password",
            "first_name",
            "last_name",
            "phone",
            "profile",
            "is_admin",
            "is_officer",
            "is_agent",
            "is_active",
            "is_staff",
            "is_mobile",
            "directorate",
            "department",
            "county",
            "user_type",
            "group_ids",
            "permission_ids",
        )

    def create(self, validated_data):
        groups = validated_data.pop("groups", [])
        permissions = validated_data.pop("user_permissions", [])
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        if groups:
            user.groups.set(groups)
        if permissions:
            user.user_permissions.set(permissions)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=False)
    username = serializers.CharField(required=False, max_length=150)
    group_ids = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(),
        source="groups",
        many=True,
        required=False,
    )
    permission_ids = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(),
        source="user_permissions",
        many=True,
        required=False,
    )

    class Meta:
        model = User
        fields = (
            "email",
            "username",
            "first_name",
            "last_name",
            "phone",
            "gender",
            "bio",
            "profile",
            "is_active",
            "suspend",
            "is_admin",
            "is_officer",
            "is_agent",
            "is_staff",
            "is_mobile",
            "directorate",
            "department",
            "county",
            "user_type",
            "group_ids",
            "permission_ids",
        )

    def validate_email(self, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Email is required.")
        qs = User.objects.filter(email__iexact=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_username(self, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Username is required.")
        qs = User.objects.filter(username__iexact=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def update(self, instance, validated_data):
        groups = validated_data.pop("groups", None)
        permissions = validated_data.pop("user_permissions", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if groups is not None:
            instance.groups.set(groups)
        if permissions is not None:
            instance.user_permissions.set(permissions)
        return instance


class UserStatusSerializer(serializers.Serializer):
    is_active = serializers.BooleanField(required=False)
    suspend = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Provide is_active and/or suspend.")
        return attrs
