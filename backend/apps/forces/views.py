from django.db.models import Count, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsActiveUser
from apps.core.cache import LONG, MEDIUM, cache_response
from apps.forces.permissions import CanViewForce

from .models import Force
from .serializers import ForceDetailSerializer, ForceListSerializer


class ForcePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class ForceViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveUser, CanViewForce]
    pagination_class = ForcePagination

    def get_queryset(self):
        qs = Force.objects.all()
        search   = self.request.query_params.get("search", "").strip()
        district = self.request.query_params.get("district", "").strip()
        status   = self.request.query_params.get("status", "").strip()
        rank     = self.request.query_params.get("rank", "").strip()

        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(badge_number__icontains=search)
                | Q(unit__icontains=search)
                | Q(phone__icontains=search)
            )
        if district:
            qs = qs.filter(district__iexact=district)
        if status:
            qs = qs.filter(status=status)
        if rank:
            qs = qs.filter(rank=rank)
        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ForceDetailSerializer
        return ForceListSerializer

    @action(detail=False, methods=["get"])
    @cache_response(timeout=MEDIUM, key_prefix="forces.stats")
    def stats(self, request):
        agg = Force.objects.aggregate(
            total=Count("id"),
            on_duty=Count("id", filter=Q(status=Force.Status.ON_DUTY)),
            on_leave=Count("id", filter=Q(status=Force.Status.ON_LEAVE)),
            suspended=Count("id", filter=Q(status=Force.Status.SUSPENDED)),
        )
        return Response(agg)

    @action(detail=False, methods=["get"])
    @cache_response(timeout=LONG, key_prefix="forces.districts")
    def districts(self, request):
        """Return distinct districts that have forces."""
        result = (
            Force.objects.values_list("district", flat=True)
            .distinct()
            .order_by("district")
        )
        return Response(list(result))
