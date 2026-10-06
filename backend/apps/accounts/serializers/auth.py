from rest_framework import serializers

from apps.accounts.models import User


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=4, max_length=6)


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=4, max_length=6)
    new_password = serializers.CharField(write_only=True, min_length=8)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "phone", "first_name", "last_name"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserLoginSerializer(serializers.ModelSerializer):
    """Lightweight user payload for login responses."""

    full_name = serializers.SerializerMethodField()
    directorate_id = serializers.SerializerMethodField()
    directorate_name = serializers.SerializerMethodField()
    county_id = serializers.SerializerMethodField()
    county_name = serializers.SerializerMethodField()
    profile_url = serializers.SerializerMethodField()
    role = serializers.CharField(read_only=True)
    user_type_name = serializers.CharField(
        source="user_type.name", read_only=True, default=None, allow_null=True
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
            "is_admin",
            "is_officer",
            "is_agent",
            "is_superuser",
            "is_staff",
            "role",
            "user_type",
            "user_type_name",
            "directorate_id",
            "directorate_name",
            "county_id",
            "county_name",
            "profile_url",
        )
        read_only_fields = fields

    def get_full_name(self, obj: User) -> str:
        return obj.get_full_name() or obj.email

    def get_directorate_id(self, obj: User) -> int | None:
        return obj.directorate_id

    def get_directorate_name(self, obj: User) -> str | None:
        return obj.directorate.name if obj.directorate_id else None

    def get_county_id(self, obj: User) -> int | None:
        return obj.county_id

    def get_county_name(self, obj: User) -> str | None:
        return obj.county.name if obj.county_id else None

    def get_profile_url(self, obj: User) -> str | None:
        from apps.accounts.serializers.user import user_profile_photo_url

        return user_profile_photo_url(obj, self.context.get("request"))


class UserMeSerializer(UserLoginSerializer):
    """Full profile for /auth/me/ including permissions and bio."""

    permissions = serializers.SerializerMethodField()
    bio = serializers.CharField(read_only=True)
    date_joined = serializers.DateTimeField(read_only=True)
    last_login = serializers.DateTimeField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    suspend = serializers.BooleanField(read_only=True)

    class Meta(UserLoginSerializer.Meta):
        fields = UserLoginSerializer.Meta.fields + (
            "bio",
            "permissions",
            "date_joined",
            "last_login",
            "is_active",
            "suspend",
        )

    def get_permissions(self, obj: User) -> list[str]:
        from apps.accounts.permissions import client_permissions_for_user

        return client_permissions_for_user(obj)


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["first_name", "last_name", "phone", "gender", "bio", "profile"]
        extra_kwargs = {"profile": {"required": False}}
