from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.models import County, Department, Directorate, Region, Relationship, SubCounty, UserType

User = get_user_model()


class UserTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserType
        fields = ("id", "name", "code")


class DirectorateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Directorate
        fields = ("id", "name", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class DepartmentSerializer(serializers.ModelSerializer):
    county_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=County.objects.all(),
        source="counties",
        required=False,
    )
    counties = serializers.SerializerMethodField()
    taliye_user_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    taliye = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = (
            "id",
            "name",
            "county_ids",
            "counties",
            "taliye_user_id",
            "taliye",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "counties", "taliye")

    def get_counties(self, obj):
        return [{"id": c.id, "name": c.name} for c in obj.counties.all()]

    def get_taliye(self, obj):
        qs = User.objects.filter(department_id=obj.pk).only(
            "id", "first_name", "last_name", "username", "phone", "user_type_id"
        )
        user = qs.filter(user_type__name__iexact="taliye_qebeed").first() or qs.first()
        if not user:
            return None
        return {
            "id": user.id,
            "name": (user.get_full_name() or user.username or "").strip(),
            "username": user.username,
            "phone": user.phone or "",
        }

    def _assign_taliye(self, department, user_id):
        if user_id in (None, ""):
            return
        ut, _ = UserType.objects.get_or_create(name="taliye_qebeed", defaults={"code": "TQB"})
        user = User.objects.filter(pk=int(user_id)).first()
        if not user:
            raise serializers.ValidationError({"taliye_user_id": "User lama helin."})
        User.objects.filter(
            department_id=department.pk,
            user_type__name__iexact="taliye_qebeed",
        ).exclude(pk=user.pk).update(department=None)
        user.department = department
        user.user_type = ut
        user.save(update_fields=["department", "user_type"])

    def create(self, validated_data):
        taliye_id = validated_data.pop("taliye_user_id", None)
        counties = validated_data.pop("counties", [])
        dept = Department.objects.create(**validated_data)
        if counties:
            dept.counties.set(counties)
        self._assign_taliye(dept, taliye_id)
        return dept

    def update(self, instance, validated_data):
        taliye_id = validated_data.pop("taliye_user_id", serializers.empty)
        counties = validated_data.pop("counties", None)
        instance.name = validated_data.get("name", instance.name)
        instance.save()
        if counties is not None:
            instance.counties.set(counties)
        if taliye_id is not serializers.empty:
            self._assign_taliye(instance, taliye_id)
        return instance


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = ("id", "name", "code", "description")


class CountySerializer(serializers.ModelSerializer):
    region_name = serializers.CharField(source="region.name", read_only=True, default=None)

    class Meta:
        model = County
        fields = ("id", "name", "code", "description", "image", "region", "region_name")


class SubCountySerializer(serializers.ModelSerializer):
    county_name = serializers.CharField(source="county.name", read_only=True, default=None)

    class Meta:
        model = SubCounty
        fields = ("id", "name", "code", "description", "county", "county_name")


class RelationshipSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="relationship", read_only=True)

    class Meta:
        model = Relationship
        fields = ("id", "relationship", "name")
