from __future__ import annotations

from dataclasses import dataclass

from django.http import HttpRequest


@dataclass(frozen=True)
class ClientMeta:
    ip_address: str | None
    operating_system: str
    browser: str
    user_agent: str


class RequestMeta:
    @staticmethod
    def from_request(request: HttpRequest | None) -> ClientMeta:
        if request is None:
            return ClientMeta(None, "", "", "")

        ua = request.META.get("HTTP_USER_AGENT", "")[:255]
        ip = RequestMeta.get_client_ip(request)
        os_name, browser = RequestMeta.parse_user_agent(ua)
        return ClientMeta(ip, os_name, browser, ua)

    @staticmethod
    def get_client_ip(request: HttpRequest) -> str | None:
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded:
            return forwarded.split(",")[0].strip()[:45]
        remote = request.META.get("REMOTE_ADDR")
        return remote[:45] if remote else None

    @staticmethod
    def parse_user_agent(ua: str) -> tuple[str, str]:
        if not ua:
            return "", ""
        lower = ua.lower()
        os_name = ""
        if "windows" in lower:
            os_name = "Windows"
        elif "android" in lower:
            os_name = "Android"
        elif "iphone" in lower or "ipad" in lower:
            os_name = "iOS"
        elif "mac os" in lower or "macintosh" in lower:
            os_name = "macOS"
        elif "linux" in lower:
            os_name = "Linux"

        browser = ""
        if "edg/" in lower or "edge" in lower:
            browser = "Edge"
        elif "chrome/" in lower and "chromium" not in lower:
            browser = "Chrome"
        elif "firefox/" in lower:
            browser = "Firefox"
        elif "safari/" in lower and "chrome" not in lower:
            browser = "Safari"
        elif "dart" in lower or "flutter" in lower:
            browser = "Mobile App"

        return os_name or "Unknown", browser or "Unknown"
