from django.core.paginator import Paginator
from django.utils.functional import cached_property
from rest_framework.pagination import PageNumberPagination


class SurveyPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class CountOverridePaginator(Paginator):
    """Paginator that accepts a pre-computed count (avoids heavy annotated COUNT)."""

    def __init__(self, object_list, per_page, count_override=None, **kwargs):
        self._count_override = count_override
        super().__init__(object_list, per_page, **kwargs)

    @cached_property
    def count(self):
        if self._count_override is not None:
            return self._count_override
        return super().count


class ResponsePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100
    django_paginator_class = CountOverridePaginator

    def paginate_queryset(self, queryset, request, view=None):
        page_size = self.get_page_size(request)
        if not page_size:
            return None

        count_override = None
        if view is not None and hasattr(view, "get_response_list_count"):
            count_override = view.get_response_list_count()

        paginator = self.django_paginator_class(
            queryset,
            page_size,
            count_override=count_override,
        )
        page_number = self.get_page_number(request, paginator)
        try:
            self.page = paginator.page(page_number)
        except Exception:
            self.page = paginator.page(1)
            page_number = 1

        if paginator.num_pages > 1 and self.template is not None:
            self.display_page_controls = True

        self.request = request
        return list(self.page)
