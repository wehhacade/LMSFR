"""Legacy mobile JSON envelopes — matches old Accounts.views.Messages."""


def legacy_validation(message: str) -> dict:
    return {
        "isError": True,
        "Message": message,
        "title": "Validation Error",
        "type": "question",
        "position": "top-end",
    }


def legacy_success(message: str) -> dict:
    return {
        "isError": False,
        "Message": message,
        "Title": "Congratulation !",
        "type": "success",
    }
