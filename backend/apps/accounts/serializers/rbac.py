from django.contrib.auth.models import Group, Permission
from rest_framework import serializers


class PermissionSerializer(serializers.ModelSerializer):
    app_label = serializers.CharField(source="content_type.app_label", read_only=True)
    model = serializers.CharField(source="content_type.model", read_only=True)

    class Meta:
        model = Permission
        fields = ("id", "name", "codename", "app_label", "model")


class GroupListSerializer(serializers.ModelSerializer):
    permission_count = serializers.IntegerField(source="_permission_count", read_only=True)

    class Meta:
        model = Group
        fields = ("id", "name", "permission_count")


class GroupDetailSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)
    permission_ids = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(),
        source="permissions",
        many=True,
        write_only=True,
        required=False,
    )

    class Meta:
        model = Group
        fields = ("id", "name", "permissions", "permission_ids")


class GroupCreateSerializer(serializers.ModelSerializer):
    permission_ids = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(),
        source="permissions",
        many=True,
        required=False,
    )

    class Meta:
        model = Group
        fields = ("name", "permission_ids")

    def create(self, validated_data):
        permissions = validated_data.pop("permissions", [])
        group = Group.objects.create(**validated_data)
        if permissions:
            group.permissions.set(permissions)
        return group


class GroupUpdateSerializer(serializers.ModelSerializer):
    permission_ids = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(),
        source="permissions",
        many=True,
        required=False,
    )

    class Meta:
        model = Group
        fields = ("name", "permission_ids")

    def update(self, instance, validated_data):
        permissions = validated_data.pop("permissions", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if permissions is not None:
            instance.permissions.set(permissions)
        return instance
