from .base import *

DEBUG = True
ALLOWED_HOSTS = ["*"]

# Next.js picks 3001, 3002, … when 3000 is already in use on the host.
# Also allow LAN phones (e.g. http://10.x.x.x:3000) during local testing.
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://localhost:\d+$",
    r"^http://127\.0\.0\.1:\d+$",
    r"^http://10\.\d{1,3}\.\d{1,3}\.\d{3}:\d+$",
    r"^http://192\.168\.\d{1,3}\.\d{1,3}:\d+$",
    r"^http://172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}:\d+$",
]

# Silk profiling deadlocks under production load (PostgreSQL) — opt in only for local debugging.
import os

if os.environ.get("SILK_ENABLED", "").lower() in ("1", "true", "yes"):
    SILK_PYTHON_PROFILER = True
else:
    INSTALLED_APPS = [app for app in INSTALLED_APPS if app != "silk"]
    MIDDLEWARE = [m for m in MIDDLEWARE if "silk" not in m]
