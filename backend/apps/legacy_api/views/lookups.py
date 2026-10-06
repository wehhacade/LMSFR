"""Old /APIs lookup endpoints — get-county, get-laamaha, etc."""

from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models.user import Country, County, IdentityType, Relationship, Section, SubCounty
from apps.accounts.permissions import IsActiveUser
from apps.core.cache import LONG, make_cache_key
from apps.legacy_api.helpers import legacy_catch, legacy_ok
from apps.suspects.models import SuspectStatus


def _lookup_perms(view):
    return permission_classes([IsAuthenticated, IsActiveUser])(view)


@_lookup_perms
@api_view(["GET"])
@legacy_catch
def get_county(request):
    from apps.accounts.call_roles import (
        is_dev,
        is_taliye_degmo,
        is_taliye_qebeed,
        qeyb_county_ids,
    )

    qs = County.objects.only("id", "name").order_by("name")
    # Scoped roles must not share the global all-counties cache.
    scoped = False
    if not is_dev(request.user):
        if is_taliye_qebeed(request.user):
            scoped = True
            qeyb_ids = qeyb_county_ids(request.user)
            qs = qs.filter(pk__in=qeyb_ids) if qeyb_ids else qs.none()
        elif is_taliye_degmo(request.user):
            scoped = True
            county_id = getattr(request.user, "county_id", None)
            qs = qs.filter(pk=county_id) if county_id else qs.none()

    if not scoped:
        cache_key = make_cache_key("legacy", "county")
        cached = cache.get(cache_key)
        if cached is not None:
            return legacy_ok(cached)

    seen: set[str] = set()
    message = []
    for row in qs:
        if row.name in seen:
            continue
        seen.add(row.name)
        message.append({"id": row.id, "name": row.name})
    if not scoped:
        cache.set(make_cache_key("legacy", "county"), message, LONG)
    return legacy_ok(message)


@_lookup_perms
@api_view(["GET"])
@legacy_catch
def get_sub_county(request):
    county_id = request.GET.get("county") or request.GET.get("cid")
    qs = SubCounty.objects.select_related("county").only(
        "id", "name", "county_id"
    ).order_by("name")
    if county_id:
        if str(county_id).isdigit():
            qs = qs.filter(county_id=int(county_id))
        else:
            qs = qs.filter(county_id=county_id)

    message = [
        {
            "id": row.id,
            "cid": row.county_id,
            "name": row.name,
        }
        for row in qs.filter(county__isnull=False)[:500]
    ]
    return legacy_ok(message)


@_lookup_perms
@api_view(["GET"])
@legacy_catch
def get_laamaha(request):
    sub_id = request.GET.get("sub_county") or request.GET.get("suid")
    qs = Section.objects.select_related("sub_county").only(
        "id", "name", "sub_county_id"
    ).order_by("name")
    if sub_id:
        if str(sub_id).isdigit():
            qs = qs.filter(sub_county_id=int(sub_id))
        else:
            qs = qs.filter(sub_county_id=sub_id)

    message = [
        {
            "id": row.id,
            "suid": row.sub_county_id,
            "name": row.name,
        }
        for row in qs.filter(sub_county__isnull=False)[:500]
    ]
    return legacy_ok(message)


@_lookup_perms
@api_view(["GET"])
@legacy_catch
def get_identity_type(request):
    cache_key = make_cache_key("legacy", "identity-type")
    cached = cache.get(cache_key)
    if cached is not None:
        return legacy_ok(cached)
    message = [{"id": row.id, "name": row.name} for row in IdentityType.objects.only("id", "name").order_by("name")]
    cache.set(cache_key, message, LONG)
    return legacy_ok(message)


@_lookup_perms
@api_view(["GET"])
@legacy_catch
def get_countries(request):
    cache_key = make_cache_key("legacy", "countries")
    cached = cache.get(cache_key)
    # Do not serve a cached empty list — countries may have been added after first fetch.
    if cached:
        return legacy_ok(cached)
    message = [{"id": row.id, "name": row.name} for row in Country.objects.only("id", "name").order_by("name")]
    if message:
        cache.set(cache_key, message, LONG)
    else:
        cache.delete(cache_key)
    return legacy_ok(message)


@_lookup_perms
@api_view(["GET"])
@legacy_catch
def get_relationships(request):
    cache_key = make_cache_key("legacy", "relationships")
    cached = cache.get(cache_key)
    if cached is not None:
        return legacy_ok(cached)
    message = [
        {"id": row.id, "name": row.relationship}
        for row in Relationship.objects.only("id", "relationship").order_by("id")
    ]
    cache.set(cache_key, message, LONG)
    return legacy_ok(message)


@_lookup_perms
@api_view(["GET"])
@legacy_catch
def get_suspect_status(request):
    cache_key = make_cache_key("legacy", "suspect-status")
    cached = cache.get(cache_key)
    if cached is not None:
        return legacy_ok(cached)
    message = [{"id": row.id, "name": row.name} for row in SuspectStatus.objects.only("id", "name").order_by("name")]
    cache.set(cache_key, message, LONG)
    return legacy_ok(message)
