from django.contrib import admin

from apps.personnel.models import (
    AbsenceReason,
    AgentAssignmentHistory,
    AgentAttendanceRecord,
    AgentAttendanceSession,
    AgentImportBatch,
    AgentImportRow,
    AgentRestriction,
    AgentStatus,
    AgentStatusHistory,
    AttendanceStatus,
)

admin.site.register(AgentStatus)
admin.site.register(AttendanceStatus)
admin.site.register(AbsenceReason)
admin.site.register(AgentAssignmentHistory)
admin.site.register(AgentStatusHistory)
admin.site.register(AgentAttendanceSession)
admin.site.register(AgentAttendanceRecord)
admin.site.register(AgentRestriction)
admin.site.register(AgentImportBatch)
admin.site.register(AgentImportRow)
