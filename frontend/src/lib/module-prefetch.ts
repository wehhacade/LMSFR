import type { QueryClient } from "@tanstack/react-query";
import {
  accountKeys,
  fetchAllGroups,
  fetchAllPermissions,
  fetchCounties,
  fetchQeybs,
  fetchUserTypes,
  fetchPermissionAssignments,
  fetchUserStats,
  fetchUsers,
} from "@/lib/accounts-api";
import { agentKeys, fetchAgents, fetchAppUsers } from "@/lib/agents-api";
import { auditKeys, fetchAuditTrails, fetchErrorLogs } from "@/lib/audit-api";
import {
  fetchDisarmamentRecords,
  fetchDisarmamentStats,
  fetchHubkadhigisAnalytics,
  fetchHubkadhigisLookups,
  hubkadhigisKeys,
} from "@/lib/hubkadhigis-api";
import {
  fetchAmnigaAnalytics,
  fetchAmnigaDailyReport,
  fetchAmnigaDistrictTasks,
  fetchAmnigaStats,
  fetchAmnigaUserReports,
  amnigaKeys,
} from "@/lib/amniga-api";
import {
  fetchDhacdooyinkaLookups,
  fetchDhacdooyinkaRecords,
  fetchRequirements,
  fetchUtilities,
  dhacdooyinkaKeys,
} from "@/lib/dhacdooyinka-api";
import {
  fetchSuspectDistricts,
  fetchSuspects,
  fetchSuspectStats,
  fetchSuspectTypes,
  suspectKeys,
} from "@/lib/suspects-api";
import {
  fetchRespondentMap,
  fetchRespondentSummary,
  surveyKeys,
} from "@/lib/surveys-api";

function localTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function prefetch<T>(queryClient: QueryClient, key: readonly unknown[], fn: () => Promise<T>) {
  void queryClient.prefetchQuery({ queryKey: key, queryFn: fn });
}

/** Warm caches when the user picks a sidebar item (before the page mounts). */
export function prefetchModuleMenu(queryClient: QueryClient, menuId: string) {
  switch (menuId) {
    case "ucusers":
      prefetch(queryClient, accountKeys.stats, fetchUserStats);
      prefetch(queryClient, accountKeys.counties, fetchCounties);
      prefetch(queryClient, accountKeys.userTypes, fetchUserTypes);
      prefetch(queryClient, accountKeys.qeybs, fetchQeybs);
      prefetch(queryClient, accountKeys.groups, fetchAllGroups);
      prefetch(queryClient, accountKeys.users(1, "", { county: "", role: "", is_staff: "" }), () =>
        fetchUsers({ page: 1, search: "" }),
      );
      break;
    case "ucgroups":
      prefetch(queryClient, accountKeys.groups, fetchAllGroups);
      break;
    case "ucqeybaha":
      prefetch(queryClient, accountKeys.qeybs, fetchQeybs);
      prefetch(queryClient, accountKeys.counties, fetchCounties);
      break;
    case "ucpermissions":
      prefetch(queryClient, accountKeys.permissionsAll(""), () => fetchAllPermissions(""));
      prefetch(queryClient, accountKeys.groups, fetchAllGroups);
      prefetch(queryClient, accountKeys.permissionAssignments, fetchPermissionAssignments);
      break;
    case "agents":
      prefetch(queryClient, agentKeys.list({ page: 1 }), () => fetchAgents({ page: 1 }));
      break;
    case "suspect":
      prefetch(queryClient, suspectKeys.stats, fetchSuspectStats);
      prefetch(queryClient, suspectKeys.districts, fetchSuspectDistricts);
      prefetch(queryClient, suspectKeys.types, fetchSuspectTypes);
      prefetch(queryClient, suspectKeys.list(1, "", { district: "", suspect_type: "" }), () =>
        fetchSuspects({ page: 1, search: "" }),
      );
      break;
    case "records":
      prefetch(queryClient, hubkadhigisKeys.stats, fetchDisarmamentStats);
      prefetch(queryClient, hubkadhigisKeys.lookups, fetchHubkadhigisLookups);
      prefetch(queryClient, hubkadhigisKeys.list(1, "", { county: "", weapon_type: "", force_unit: "" }), () =>
        fetchDisarmamentRecords({ page: 1, search: "" }),
      );
      break;
    case "forces":
      prefetch(queryClient, agentKeys.list({ page: 1 }), () => fetchAgents({ page: 1 }));
      break;
    case "appusers":
      prefetch(queryClient, agentKeys.appUsers({ page: 1 }), () => fetchAppUsers({ page: 1 }));
      break;
    case "audittrails":
      prefetch(queryClient, auditKeys.trails(1, "", false, ""), () => fetchAuditTrails(1, "", false, ""));
      break;
    case "errorlogs":
      prefetch(queryClient, auditKeys.errors(1, "", false), () => fetchErrorLogs(1, "", false));
      break;
    case "dashboard":
      prefetch(queryClient, amnigaKeys.stats, fetchAmnigaStats);
      prefetch(queryClient, amnigaKeys.analytics("7d"), () => fetchAmnigaAnalytics("7d"));
      break;
    case "userreports": {
      const params = { page: 1, pageSize: 5, search: "", county: "", activeOnly: false, topUsers: false };
      prefetch(queryClient, amnigaKeys.userReports(params as unknown as Record<string, string | number>), () => fetchAmnigaUserReports(params));
      break;
    }
    case "districttasks": {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const last = new Date(y, now.getMonth() + 1, 0).getDate();
      const dateFrom = `${y}-${m}-01`;
      const dateTo = `${y}-${m}-${String(last).padStart(2, "0")}`;
      const params = { page: 1, pageSize: 5, search: "", dateFrom, dateTo };
      prefetch(queryClient, amnigaKeys.districtTasks(params as unknown as Record<string, string | number>), () => fetchAmnigaDistrictTasks(params));
      break;
    }
    case "dailyreport": {
      const today = localTodayIso();
      prefetch(queryClient, amnigaKeys.dailyReport(today, today, ""), () => fetchAmnigaDailyReport(today, "", today));
      prefetch(queryClient, accountKeys.counties, fetchCounties);
      break;
    }
    case "qaybaha":
      prefetch(queryClient, dhacdooyinkaKeys.utility(""), () => fetchUtilities(""));
      break;
    case "noocaDhacdo":
      prefetch(queryClient, dhacdooyinkaKeys.utility(""), () => fetchUtilities(""));
      prefetch(queryClient, dhacdooyinkaKeys.requirements("", ""), () => fetchRequirements("", ""));
      break;
    case "dhacdooyinka":
      prefetch(queryClient, dhacdooyinkaKeys.lookups, fetchDhacdooyinkaLookups);
      prefetch(queryClient, dhacdooyinkaKeys.list(1, "", { year: "", month: "" }), () =>
        fetchDhacdooyinkaRecords({ page: 1, search: "", year: "", month: "" }),
      );
      break;
    case "settings": {
      const today = localTodayIso();
      prefetch(queryClient, surveyKeys.respondents.summary("", "", today, today), () =>
        fetchRespondentSummary({ dateFrom: today, dateTo: today }),
      );
      prefetch(queryClient, surveyKeys.respondents.map("", "", today, today, ""), () =>
        fetchRespondentMap({ dateFrom: today, dateTo: today }),
      );
      break;
    }
  }
}
