from django.contrib import admin

from apps.audit.models import APITrafficLog, AuditTrail, ErrorLog

admin.site.register(AuditTrail)
admin.site.register(ErrorLog)
admin.site.register(APITrafficLog)
