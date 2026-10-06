from django.db import models


class Rank(models.Model):
    name = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "disarmament_ranks"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class ForceUnit(models.Model):
    name = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "force_units"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class WeaponType(models.Model):
    name = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "weapon_types"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class SurrenderLocation(models.Model):
    name = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "surrender_locations"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
