from datetime import timedelta
import environ
from corsheaders.defaults import default_headers
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = BASE_DIR.parent

env = environ.Env()

# Single env file at repo root (see .env.example). Docker Compose also injects POSTGRES_* / REDIS_URL.
_env_file = ROOT_DIR / ".env"
if _env_file.is_file():
    environ.Env.read_env(_env_file)

SECRET_KEY = env("SECRET_KEY")
DEBUG = env.bool("DEBUG", default=False)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])

# Behind Apache / AWS ELB — trust X-Forwarded-Proto for HTTPS
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework.authtoken",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "silk",
]

LOCAL_APPS = [
    "apps.accounts",
    "apps.api",
    "apps.core",
    "apps.audit",
    "apps.suspects",
    "apps.legacy_api",
    "apps.forces",
    "apps.surveys",
    "apps.mobile",
    "apps.hubkadhigis",
    "apps.amniga",
    "apps.dhacdooyinka",
    "apps.baaris",
    "apps.investigation",
    "apps.personnel",
    "apps.visitors",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.mobile.middleware.AppVersionGateMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.audit.middleware.APITrafficMiddleware",
    "silk.middleware.SilkyMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

def _database_settings() -> dict:
    """Prefer POSTGRES_* from Docker Compose; allow DATABASE_URL override for legacy tooling."""
    database_url = env.str("DATABASE_URL", default="")
    if database_url:
        return {**env.db_url_config(database_url), "CONN_MAX_AGE": 60}
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", default="lmsbrdb"),
        "USER": env("POSTGRES_USER", default="postgres"),
        "PASSWORD": env("POSTGRES_PASSWORD", default=""),
        "HOST": env("POSTGRES_HOST", default="localhost"),
        "PORT": env("POSTGRES_PORT", default="5432"),
        "CONN_MAX_AGE": 60,
    }


DATABASES = {
    "default": _database_settings(),
}

# ---------------------------------------------------------------------------
# Redis / Cache
# ---------------------------------------------------------------------------
REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "KEY_PREFIX": "app",
        "TIMEOUT": 300,  # default TTL matches MEDIUM
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            # ZlibCompressor removed: payloads are <200 bytes; compression CPU cost
            # exceeds network savings and makes cache HITs slower than cache MISSes.
            "CONNECTION_POOL_KWARGS": {
                "max_connections": 50,
            },
            "SOCKET_CONNECT_TIMEOUT": 5,
            "SOCKET_TIMEOUT": 5,
            # Silently return None on Redis errors instead of raising
            "IGNORE_EXCEPTIONS": True,
        },
    }
}

# Cache-control middleware defaults
CACHE_MIDDLEWARE_SECONDS = 300
CACHE_MIDDLEWARE_KEY_PREFIX = "app"

# Per-view timeout constants (seconds) — also defined in apps.core.cache
CACHE_TTL_SHORT = 60
CACHE_TTL_MEDIUM = 300
CACHE_TTL_LONG = 3600

SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"
SESSION_COOKIE_AGE = env.int("SESSION_IDLE_MINUTES", default=15) * 60
SESSION_SAVE_EVERY_REQUEST = True
# Web idle timeout above mirrors old SessionTimeoutMiddleware.
# Mobile clients use JWT lifetimes below — no server-side idle lockout on API tokens.

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.accounts.authentication.CachedJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "EXCEPTION_HANDLER": "apps.audit.exceptions.custom_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_MINUTES", default=60)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_DAYS", default=1)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = (
    *default_headers,
    "x-app-version-code",
    "x-lmsbr-client",
)

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
# Daily sweep of expired survey response deadlines → FCM (requires celery beat).
CELERY_BEAT_SCHEDULE = {
    "notify-expired-survey-deadlines": {
        "task": "apps.surveys.tasks.notify_expired_survey_deadlines_async",
        "schedule": 60 * 60,  # hourly
    },
    "notify-inactive-app-users": {
        "task": "apps.accounts.tasks.notify_inactive_app_users",
        "schedule": 60 * 60,  # hourly; task de-duplicates per inactivity episode
    },
}

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Absolute base for photo URLs returned to web/mobile clients
PUBLIC_API_BASE_URL = env("PUBLIC_API_BASE_URL",
                          default="http://localhost:8000")
SERVE_MEDIA = env.bool("SERVE_MEDIA", default=False)

# InsightFace (suspect 1:N search). Mobile/TipPhone keep calling /face-match;
# Django holds the key and proxies to the lmsbr-suspects collection.
INSIGHTFACE_BASE_URL = env("INSIGHTFACE_BASE_URL", default="")
INSIGHTFACE_API_KEY = env("INSIGHTFACE_API_KEY", default="")
INSIGHTFACE_ENABLED = env.bool("INSIGHTFACE_ENABLED", default=True)
INSIGHTFACE_SUSPECTS_COLLECTION = env("INSIGHTFACE_SUSPECTS_COLLECTION", default="lmsbr-suspects")
INSIGHTFACE_SEARCH_THRESHOLD = env.float("INSIGHTFACE_SEARCH_THRESHOLD", default=0.4)
INSIGHTFACE_DEDUP_THRESHOLD = env.float("INSIGHTFACE_DEDUP_THRESHOLD", default=0.55)
INSIGHTFACE_TIMEOUT_SECONDS = env.int("INSIGHTFACE_TIMEOUT_SECONDS", default=30)

# Access Gateway (NIRA / identity provider proxy for Visitors app).
# Keep API key server-side; mobile/web must never embed it.
ACCESS_GATEWAY_BASE_URL = env("ACCESS_GATEWAY_BASE_URL", default="")
ACCESS_GATEWAY_API_KEY = env("ACCESS_GATEWAY_API_KEY", default="")
ACCESS_GATEWAY_PROJECT_SLUG = env("ACCESS_GATEWAY_PROJECT_SLUG", default="hubiye-api")
ACCESS_GATEWAY_DEFAULT_SEEDING_REASON_CODE = env("ACCESS_GATEWAY_DEFAULT_SEEDING_REASON_CODE", default="")
ACCESS_GATEWAY_TIMEOUT_SECONDS = env.int("ACCESS_GATEWAY_TIMEOUT_SECONDS", default=15)
# When BASE_URL is a public NAT IP, AccessHub still expects the private Host.
ACCESS_GATEWAY_HOST_HEADER = env("ACCESS_GATEWAY_HOST_HEADER", default="")

# Firebase Cloud Messaging (path to service account JSON — not committed)
FIREBASE_CREDENTIALS_PATH = env(
    "FIREBASE_CREDENTIALS_PATH",
    default=str(BASE_DIR / "serviceAccountKey.json"),
)

# LiveKit Cloud — county-wide walkie broadcast (optional; empty → API returns isError)
LIVEKIT_URL = env("LIVEKIT_URL", default="")
LIVEKIT_API_KEY = env("LIVEKIT_API_KEY", default="")
LIVEKIT_API_SECRET = env("LIVEKIT_API_SECRET", default="")

# Suspect photo upload — legacy NISA: max 1920×1080, JPEG quality 60
SUSPECT_PHOTO_MAX_SIZE = (
    env.int("SUSPECT_PHOTO_MAX_WIDTH", default=1920),
    env.int("SUSPECT_PHOTO_MAX_HEIGHT", default=1080),
)
SUSPECT_PHOTO_JPEG_QUALITY = env.int("SUSPECT_PHOTO_JPEG_QUALITY", default=60)

# HRM / Ilaalo-shacab employee tree (optional — Search HRM on Isticmalaayasha)
HRM_EMPLOYEE_TREE_URL = env("HRM_EMPLOYEE_TREE_URL", default="")
HRM_TOKEN = env("HRM_TOKEN", default="")
HRM_USER_ID = env("HRM_USER_ID", default="")
HRM_TIMEOUT = env.int("HRM_TIMEOUT", default=15)
HRM_VERIFY_SSL = env.bool("HRM_VERIFY_SSL", default=False)

# Media storage — S3 when AWS_* credentials are set (legacy + new uploads).
# Set USE_S3=False to force local FileSystemStorage under MEDIA_ROOT.
AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default="")
AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default="")
AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="ap-northeast-1")
AWS_STORAGE_BUCKET_NAME = env(
    "AWS_STORAGE_BUCKET_NAME", default="lmsbr-bucket")
AWS_S3_PRESIGNED_EXPIRY = env.int("AWS_S3_PRESIGNED_EXPIRY", default=3600)
_use_s3_env = env("USE_S3", default=None)
if _use_s3_env is None:
    USE_S3 = bool(AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and AWS_STORAGE_BUCKET_NAME)
else:
    USE_S3 = env.bool("USE_S3", default=False)

# Prefixes stored in DB as relative keys (legacy MySQL + v3 uploads)
AWS_S3_LEGACY_MEDIA_PREFIXES = (
    "suspects/",
    "damiinada/",
    "suspect_images/",
    "damiinka_pictures/",
    "Damiinada_pictures/",
    "damiinada_pictures/",
    "avatars/",
    "agents/",
    "uploads/agents/",
    "uploads/surveys/",
    "uploads/hubkadhigista/",
    "uploads/disarmament/",
    "fejignaanta/",
    "dhacdo_documents/",
    "dhacdooyinka/",
    "SuspectResponseImg/",
    "suspectresponseimg/",
    "ResponseAudio/",
    "responseaudio/",
    "car_pictures/",
    "carpictures/",
    "warbixinada_images/",
    "wanted_images/",
)

if USE_S3:
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = True
    AWS_S3_FILE_OVERWRITE = False
    AWS_S3_SIGNATURE_VERSION = "s3v4"
    AWS_S3_ADDRESSING_STYLE = "virtual"
    AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
            "OPTIONS": {
                "access_key": AWS_ACCESS_KEY_ID,
                "secret_key": AWS_SECRET_ACCESS_KEY,
                "bucket_name": AWS_STORAGE_BUCKET_NAME,
                "region_name": AWS_S3_REGION_NAME,
                "default_acl": None,
                "querystring_auth": True,
                "file_overwrite": False,
                "signature_version": "s3v4",
                "addressing_style": "virtual",
                "object_parameters": {"CacheControl": "max-age=86400"},
            },
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
else:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "apps": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
