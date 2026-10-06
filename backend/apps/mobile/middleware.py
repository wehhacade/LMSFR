"""Refuse phone builds older than AppVersionPolicy.min_version_code."""

from apps.mobile.app_version import version_block_response


class AppVersionGateMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        blocked = version_block_response(request)
        if blocked is not None:
            return blocked
        return self.get_response(request)
