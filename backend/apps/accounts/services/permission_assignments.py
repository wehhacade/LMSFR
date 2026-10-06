"""Build permission assignment matrix for the admin permissions UI."""

from __future__ import annotations

from collections import defaultdict

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

User = get_user_model()


def _user_display(user: User) -> str:
    full = user.get_full_name()
    return full.strip() if full else user.email


def _assignment_index() -> dict:
    """Shared group/user/permission index used by list + holder lookups."""
    groups = list(Group.objects.prefetch_related("permissions").order_by("name"))

    group_perm_ids: dict[int, list[int]] = {}
    for group in groups:
        group_perm_ids[group.id] = [p.id for p in group.permissions.all()]

    group_user_ids: dict[int, list[int]] = defaultdict(list)
    user_group_ids: dict[int, list[int]] = defaultdict(list)
    for group_id, user_id in User.groups.through.objects.values_list("group_id", "user_id"):
        group_user_ids[group_id].append(user_id)
        user_group_ids[user_id].append(group_id)

    user_direct_perms: dict[int, list[int]] = defaultdict(list)
    for user_id, perm_id in User.user_permissions.through.objects.values_list("user_id", "permission_id"):
        user_direct_perms[user_id].append(perm_id)

    affected_user_ids = set(user_direct_perms.keys()) | set(user_group_ids.keys())
    users_by_id: dict[int, User] = {}
    if affected_user_ids:
        users_by_id = User.objects.in_bulk(affected_user_ids)

    return {
        "groups": groups,
        "group_perm_ids": group_perm_ids,
        "group_user_ids": group_user_ids,
        "user_group_ids": user_group_ids,
        "user_direct_perms": user_direct_perms,
        "users_by_id": users_by_id,
    }


def build_permission_holders(permission_id: int) -> list[dict]:
    """Effective users/groups holding a single permission (lazy UI load)."""
    idx = _assignment_index()
    groups = idx["groups"]
    group_perm_ids = idx["group_perm_ids"]
    group_user_ids = idx["group_user_ids"]
    user_direct_perms = idx["user_direct_perms"]
    users_by_id = idx["users_by_id"]

    holders: list[dict] = []
    seen: set[tuple] = set()

    def add(holder: dict) -> None:
        key = (holder["id"], holder.get("via"), holder.get("group_id"))
        if key in seen:
            return
        seen.add(key)
        holders.append(holder)

    for group in groups:
        if permission_id not in group_perm_ids.get(group.id, []):
            continue
        for uid in group_user_ids.get(group.id, []):
            user = users_by_id.get(uid)
            if user is None:
                continue
            add(
                {
                    "id": str(uid),
                    "name": _user_display(user),
                    "via": "group",
                    "group_id": group.id,
                    "group_name": group.name,
                }
            )

    for uid, perm_ids in user_direct_perms.items():
        if permission_id not in perm_ids:
            continue
        user = users_by_id.get(uid)
        if user is None:
            continue
        add({"id": str(uid), "name": _user_display(user), "via": "direct"})

    holders.sort(key=lambda h: h["name"].lower())
    return holders


def build_permission_assignments_payload(*, include_holders: bool = False) -> dict:
    idx = _assignment_index()
    groups = idx["groups"]
    group_perm_ids = idx["group_perm_ids"]
    group_user_ids = idx["group_user_ids"]
    user_group_ids = idx["user_group_ids"]
    user_direct_perms = idx["user_direct_perms"]
    users_by_id = idx["users_by_id"]
    affected_user_ids = set(user_direct_perms.keys()) | set(user_group_ids.keys())

    permission_users: dict[int, list[dict]] = {}
    permission_holder_counts: dict[str, int] = {}

    def add_holder(perm_id: int, holder: dict) -> None:
        bucket = permission_users.setdefault(perm_id, [])
        key = (holder["id"], holder.get("via"), holder.get("group_id"))
        if not any((h["id"], h.get("via"), h.get("group_id")) == key for h in bucket):
            bucket.append(holder)

    group_data = []
    for group in groups:
        perm_ids = group_perm_ids[group.id]
        member_ids = group_user_ids.get(group.id, [])
        members = []
        for uid in member_ids:
            user = users_by_id.get(uid)
            if user is None:
                continue
            members.append({"id": str(uid), "name": _user_display(user)})
        members.sort(key=lambda m: m["name"].lower())
        group_data.append(
            {
                "id": group.id,
                "name": group.name,
                "permission_ids": perm_ids,
                "members": members,
            }
        )
        if include_holders:
            for uid in member_ids:
                user = users_by_id.get(uid)
                if user is None:
                    continue
                label = _user_display(user)
                for pid in perm_ids:
                    add_holder(
                        pid,
                        {
                            "id": str(uid),
                            "name": label,
                            "via": "group",
                            "group_id": group.id,
                            "group_name": group.name,
                        },
                    )

    user_data = []
    for uid in sorted(
        affected_user_ids,
        key=lambda i: (_user_display(users_by_id[i]).lower() if i in users_by_id else ""),
    ):
        user = users_by_id.get(uid)
        if user is None:
            continue
        direct_ids = user_direct_perms.get(uid, [])
        user_data.append(
            {
                "id": str(uid),
                "name": _user_display(user),
                "permission_ids": direct_ids,
                "group_ids": user_group_ids.get(uid, []),
            }
        )
        if include_holders:
            for pid in direct_ids:
                add_holder(
                    pid,
                    {
                        "id": str(uid),
                        "name": _user_display(user),
                        "via": "direct",
                    },
                )

    if include_holders:
        for pid in permission_users:
            permission_users[pid].sort(key=lambda h: h["name"].lower())
        return {
            "groups": group_data,
            "users": user_data,
            "permission_users": {str(k): v for k, v in permission_users.items()},
        }

    for group in groups:
        for pid in group_perm_ids.get(group.id, []):
            permission_holder_counts[str(pid)] = permission_holder_counts.get(str(pid), 0) + len(
                group_user_ids.get(group.id, [])
            )
    for uid, perm_ids in user_direct_perms.items():
        for pid in perm_ids:
            permission_holder_counts[str(pid)] = permission_holder_counts.get(str(pid), 0) + 1

    return {
        "groups": group_data,
        "users": user_data,
        "permission_holder_counts": permission_holder_counts,
    }
