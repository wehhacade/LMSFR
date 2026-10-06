from django.contrib.auth.models import Group
from rest_framework import serializers

from apps.accounts.models import User


class AssignGroupsSerializer(serializers.Serializer):
    group_ids = serializers.PrimaryKeyRelatedField(queryset=Group.objects.all(), many=True)


class AdminResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, min_length=8)


class AdminResetPinSerializer(serializers.Serializer):
    new_pin = serializers.CharField(max_length=6, min_length=4)


class MobileLoginTestSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
