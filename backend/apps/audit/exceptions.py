import logging

from rest_framework.views import exception_handler as drf_exception_handler

from apps.audit.services import ErrorLogService

logger = logging.getLogger(__name__)


def _collect_error_messages(data) -> list[str]:
    """Flatten DRF/serializer error payloads into readable strings."""
    messages: list[str] = []
    if isinstance(data, dict):
        for key, value in data.items():
            if key == "message":
                continue
            nested = _collect_error_messages(value)
            if not nested:
                continue
            if key in ("detail", "non_field_errors", "errors", "answers"):
                messages.extend(nested)
            else:
                for msg in nested:
                    text = str(msg)
                    if text.lower().startswith(f"{key.lower()}:"):
                        messages.append(text)
                    else:
                        messages.append(f"{key}: {text}")
    elif isinstance(data, (list, tuple)):
        for item in data:
            messages.extend(_collect_error_messages(item))
    elif data is not None and data != "":
        # ErrorDetail.__str__ returns the message text (not the repr).
        messages.append(str(data))
    return messages


def _unique_join(messages: list[str]) -> str:
    seen: set[str] = set()
    ordered: list[str] = []
    for msg in messages:
        text = msg.strip()
        if not text or text in seen:
            continue
        seen.add(text)
        ordered.append(text)
    return "; ".join(ordered)


def _attach_readable_message(response) -> str | None:
    """Ensure 4xx client errors expose a top-level `message` for mobile clients."""
    if response is None or response.status_code < 400 or response.status_code >= 500:
        return None

    data = response.data
    messages = _collect_error_messages(data)
    message = _unique_join(messages) or "Request failed. Please check your input and try again."

    if isinstance(data, dict):
        new_data = dict(data)
        new_data["message"] = message
        detail = new_data.get("detail")
        if not isinstance(detail, str) or not detail.strip():
            new_data["detail"] = message
        response.data = new_data
    else:
        response.data = {
            "message": message,
            "detail": message,
            "errors": data,
        }
    return message


def custom_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    request = context.get("request")
    status_code = response.status_code if response is not None else 500

    if status_code >= 500:
        ErrorLogService.log(
            request=request,
            exc=exc,
            status_code=status_code,
            async_write=True,
        )
    elif response is not None and 400 <= status_code < 500:
        message = _attach_readable_message(response)
        path = getattr(request, "path", "") if request is not None else ""
        if message and "/survey/responses" in path:
            user = getattr(request, "user", None) if request is not None else None
            data_keys = None
            if request is not None and hasattr(request, "data"):
                try:
                    data_keys = list(request.data.keys())
                except Exception:
                    data_keys = None
            logger.warning(
                "Survey response %s user_id=%s message=%s data_keys=%s",
                status_code,
                getattr(user, "pk", None),
                message,
                data_keys,
            )

    return response
