import { tiphoneApi } from "./axios";
import { ENDPOINTS } from "./endpoints";
import type {
  AppInstallationDepartment,
  AppInstallationStatus,
  AppInstallationSummary,
  AppInstallationUserRow,
  AppPermissionGroup,
  NotInstalledReason,
  CommentReplyRow,
  CountyRow,
  DamiinDetailRow,
  DamiinListRow,
  DamiinLookupRow,
  DamiinMode,
  DamiinRow,
  ExistingCaseDraft,
  LookupRow,
  ManagedUserRow,
  NoticeRow,
  ResponseCommentRow,
  SuspectCaseRow,
  SuspectListRow,
  SuspectRegisterDraft,
  SuspectResponseRow,
  SuspectVehicle,
} from "./types";
import { formatCountyLabel, PHONE_DIGIT_COUNT } from "./utils";
import { resolveLastLoginDisplay, type LastLoginDisplay } from "./login-time";

export type DistrictUserRow = {
  id: number;
  name: string;
  phone: string;
  email: string;
  total_suspect: number;
  lastlogin: LastLoginDisplay;
};

function toInt(value: unknown, fallback = 1): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = parseInt(value, 10);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function formatCountyDisplayName(name: string): string {
  return name
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapSuspectRow(raw: Record<string, unknown>): SuspectListRow {
  return {
    id: Number(raw.id ?? 0),
    name: String(raw.name ?? ""),
    mother: raw.mother ? String(raw.mother) : undefined,
    tnumber: raw.tnumber ? String(raw.tnumber) : undefined,
    photo: raw.photo ? String(raw.photo) : undefined,
    N_tuhunka: raw.N_tuhunka ? String(raw.N_tuhunka) : undefined,
    degmada: raw.degmada ? String(raw.degmada) : undefined,
    waaxda: raw.waaxda ? String(raw.waaxda) : undefined,
    xaafadda: raw.xaafadda ? String(raw.xaafadda) : undefined,
    gender: raw.gender ? String(raw.gender) : undefined,
    match_score: raw.match_score != null ? Number(raw.match_score) : undefined,
    created_ago: raw.created_ago ? String(raw.created_ago) : undefined,
    nickname: raw.nickname ? String(raw.nickname) : undefined,
    occupation: raw.occupation ? String(raw.occupation) : undefined,
    description: raw.description ? String(raw.description) : undefined,
    tribe: raw.tribe ? String(raw.tribe) : undefined,
    Dob: raw.Dob ? String(raw.Dob) : undefined,
    g_dhalashada: raw.g_dhalashada ? String(raw.g_dhalashada) : undefined,
    marital: raw.marital ? String(raw.marital) : undefined,
    jailed: raw.jailed ? String(raw.jailed) : undefined,
    date_opp: raw.date_opp ? String(raw.date_opp) : undefined,
    lambarka_diiwaanka: raw.lambarka_diiwaanka ? String(raw.lambarka_diiwaanka) : undefined,
    goobta_shaqada: raw.goobta_shaqada ? String(raw.goobta_shaqada) : undefined,
    nationality: raw.nationality != null ? String(raw.nationality) : null,
    is_released: Boolean(raw.is_released),
    case_ref: raw.case_ref ? String(raw.case_ref) : undefined,
    status: raw.status ? String(raw.status) : undefined,
    risk: raw.risk ? String(raw.risk) : undefined,
    captureTime: typeof raw.captureTime === "number" ? raw.captureTime : undefined,
    seen: raw.seen !== false,
    created_at: raw.created_at ? String(raw.created_at) : undefined,
    source: raw.source ? String(raw.source) : undefined,
    registered_by: raw.registered_by ? String(raw.registered_by) : undefined,
    registered_by_id:
      raw.registered_by_id != null ? Number(raw.registered_by_id) : undefined,
    wanted_id: raw.wanted_id != null ? Number(raw.wanted_id) : undefined,
    match_distance: raw.match_distance != null ? Number(raw.match_distance) : undefined,
  };
}

export const TipApi = {
  async fetchCounties(): Promise<CountyRow[]> {
    try {
      const { data } = await tiphoneApi.get<{ Message?: CountyRow[] }>(ENDPOINTS.getCounty);
      const rows = Array.isArray(data?.Message) ? data.Message : [];
      return rows
        .map((r) => ({ id: toInt(r.id, 0), name: formatCountyDisplayName(String(r.name ?? "")) }))
        .filter((r) => r.name);
    } catch {
      const { data } = await tiphoneApi.post<{ Message?: CountyRow[] }>(ENDPOINTS.getCounty, {});
      const rows = Array.isArray(data?.Message) ? data.Message : [];
      return rows
        .map((r) => ({ id: toInt(r.id, 0), name: formatCountyDisplayName(String(r.name ?? "")) }))
        .filter((r) => r.name);
    }
  },

  async fetchSuspectList(params: {
    userId: number | string;
    page?: number;
    county?: number | string;
    dateFilter?: string;
    searchQuery?: string;
    /** Omit for shared search; pass amniga|baaris for role-scoped browse lists. */
    source?: "amniga" | "baaris" | "";
  }): Promise<{ rows: SuspectListRow[]; currentPage: number; totalPages: number }> {
    const { data } = await tiphoneApi.post<{
      Message?: Record<string, unknown>[] | string;
      current_page?: number;
      total_pages?: number;
      isError?: boolean;
    }>(ENDPOINTS.suspectList, {
      user_id: params.userId,
      page: params.page ?? 1,
      county: params.county ?? 0,
      dateFilter: params.dateFilter ?? "",
      searchQuery: params.searchQuery ?? "",
      ...(params.source ? { source: params.source } : {}),
    });

    if (data?.isError || !Array.isArray(data?.Message)) {
      const msg =
        typeof data?.Message === "string" ? data.Message : "Liiska lama soo qaadi karin.";
      throw new Error(msg);
    }

    return {
      rows: data.Message.map(mapSuspectRow),
      currentPage: toInt(data?.current_page, params.page ?? 1),
      totalPages: Math.max(1, toInt(data?.total_pages, 1)),
    };
  },

  async registerBaarisCitizen(form: FormData): Promise<{
    ok: boolean;
    message: string;
    suspectId?: number;
    profileId?: number;
  }> {
    try {
      const { data } = await tiphoneApi.post<{
        isError?: boolean;
        Message?: string | Record<string, unknown>;
        suspect_id?: number;
        profile_id?: number;
      }>(ENDPOINTS.baarisRegisterComplete, form, { timeout: 120_000 });
      if (data?.isError) {
        const msg =
          typeof data.Message === "string"
            ? data.Message
            : "Diiwaangelinta waa fashilantay.";
        return { ok: false, message: msg };
      }
      return {
        ok: true,
        message: typeof data?.Message === "string" ? data.Message : "Waa la diiwaan geliyey.",
        suspectId: data?.suspect_id,
        profileId: data?.profile_id,
      };
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { Message?: unknown } } };
      const raw = ax.response?.data?.Message;
      const message =
        typeof raw === "string"
          ? raw
          : raw && typeof raw === "object"
            ? Object.values(raw as Record<string, unknown>)
                .flat()
                .map(String)
                .join(" ")
            : "Diiwaangelinta waa fashilantay.";
      return { ok: false, message };
    }
  },

  async fetchWantedList(params: {
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<SuspectListRow[]> {
    try {
      const { data } = await tiphoneApi.get<{
        status?: boolean;
        data?: {
          results?: Array<Record<string, unknown>>;
        };
      }>(ENDPOINTS.wantedList, {
        params: {
          page: params.page ?? 1,
          page_size: params.pageSize ?? 10,
          search: params.search ?? "",
        },
      });
      const rows = data?.data?.results ?? [];
      return rows.map((raw) => ({
        id: Number(raw.id ?? 0),
        name: String(raw.full_name ?? ""),
        mother: raw.mother_name ? String(raw.mother_name) : undefined,
        tnumber: raw.phone ? String(raw.phone) : undefined,
        photo: raw.photo_url ? String(raw.photo_url) : undefined,
        gender: raw.gender ? String(raw.gender) : undefined,
        description: raw.details ? String(raw.details) : undefined,
        N_tuhunka: raw.wanted_type ? String(raw.wanted_type) : "Wanted",
        status: "wanted",
        risk: raw.priority ? String(raw.priority) : "high",
        source: "wanted",
        created_ago: raw.date_recorded ? String(raw.date_recorded) : undefined,
      }));
    } catch {
      return [];
    }
  },

  async fetchWantedDetail(wantedId: number): Promise<SuspectListRow> {
    const { data } = await tiphoneApi.post<{
      status?: boolean;
      message?: string;
      data?: Record<string, unknown>;
    }>(ENDPOINTS.wantedDetail, { wanted_id: wantedId });
    if (!data?.status || !data.data) {
      throw new Error(data?.message || "Wanted-ka lama helin.");
    }
    const raw = data.data;
    return {
      id: Number(raw.id ?? wantedId),
      name: String(raw.full_name ?? ""),
      tnumber: raw.phone ? String(raw.phone) : undefined,
      photo: raw.photo_url ? String(raw.photo_url) : undefined,
      gender: raw.gender ? String(raw.gender) : undefined,
      nationality: raw.citizenship ? String(raw.citizenship) : undefined,
      description: raw.details ? String(raw.details) : undefined,
      N_tuhunka: raw.wanted_type ? String(raw.wanted_type) : "Wanted",
      status: raw.wanted_status ? String(raw.wanted_status) : "Wanted",
      risk: raw.priority ? String(raw.priority) : "High",
      source: "wanted",
    };
  },

  async fetchWantedTypes(): Promise<Array<{ id: number; name: string }>> {
    const { data } = await tiphoneApi.get<{
      results?: Array<{ id: number; name: string }>;
    }>(ENDPOINTS.wantedTypes);
    return Array.isArray(data?.results) ? data.results : [];
  },

  async createWanted(form: FormData): Promise<SuspectListRow> {
    const { data } = await tiphoneApi.post<Record<string, unknown>>(
      ENDPOINTS.wantedManage,
      form,
      { timeout: 120_000 },
    );
    return {
      id: Number(data.id ?? 0),
      name: String(data.full_name ?? ""),
      mother: data.mother_name ? String(data.mother_name) : undefined,
      tnumber: data.phone ? String(data.phone) : undefined,
      photo: data.photo_url ? String(data.photo_url) : undefined,
      gender: data.gender ? String(data.gender) : undefined,
      nationality: data.citizenship ? String(data.citizenship) : undefined,
      description: data.details ? String(data.details) : undefined,
      N_tuhunka: data.wanted_type ? String(data.wanted_type) : "Wanted",
      status: data.wanted_status ? String(data.wanted_status) : "Wanted",
      risk: data.priority ? String(data.priority) : "High",
      source: "wanted",
    };
  },

  async faceMatch(payload: {
    imageBase64?: string;
    vector?: number[];
    threshold?: number;
  }): Promise<{ found: boolean; message: string; matches: SuspectListRow[] }> {
    const body: Record<string, unknown> = {
      threshold: payload.threshold ?? 0.6,
    };
    if (payload.imageBase64) body.image = payload.imageBase64;
    if (payload.vector) body.vector = payload.vector;
    const { data } = await tiphoneApi.post<{
      isError?: boolean;
      found?: boolean;
      Message?: string;
      matches?: Record<string, unknown>[];
    }>(ENDPOINTS.faceMatch, body, { timeout: 120_000 });
    if (data?.isError) {
      throw new Error(typeof data.Message === "string" ? data.Message : "Face match failed");
    }
    return {
      found: Boolean(data?.found),
      message: data?.Message ?? "",
      matches: Array.isArray(data?.matches) ? data.matches.map(mapSuspectRow) : [],
    };
  },

  async storeFaceEmbedding(payload: {
    suspectId: number | string;
    imageBase64?: string;
    vector?: number[];
  }): Promise<{ ok: boolean; message: string }> {
    try {
      const body: Record<string, unknown> = { suspect_id: payload.suspectId };
      if (payload.imageBase64) body.image = payload.imageBase64;
      if (payload.vector) body.vector = payload.vector;
      const { data } = await tiphoneApi.post<{ isError?: boolean; Message?: string }>(
        ENDPOINTS.faceEmbedding,
        body,
        { timeout: 120_000 },
      );
      if (data?.isError) {
        return { ok: false, message: data.Message ?? "Face embedding failed" };
      }
      return { ok: true, message: data?.Message ?? "Face vector waa la kaydiyey." };
    } catch {
      return { ok: false, message: "Face embedding best-effort failed." };
    }
  },

  async lookupByPhone(phone: string): Promise<{
    found: boolean;
    message: string;
    matches: SuspectListRow[];
    suspectId?: number;
  }> {
    const digits = phone.replace(/\D/g, "");
    try {
      const { data } = await tiphoneApi.post<{
        Message?: string;
        found?: boolean;
        matches?: Record<string, unknown>[];
        suspect_id?: number;
      }>(ENDPOINTS.suspectLookup, { phone: digits });
      const matches = Array.isArray(data?.matches) ? data.matches.map(mapSuspectRow) : [];
      return {
        found: Boolean(data?.found),
        message: data?.Message ?? "",
        matches,
        suspectId: data?.suspect_id ?? matches[0]?.id,
      };
    } catch {
      return { found: false, message: "Raadinta lambarka way fashilantay.", matches: [] };
    }
  },

  async fetchDamiins(suspectId: string | number): Promise<DamiinRow[]> {
    try {
      const { data } = await tiphoneApi.get<{ isError?: boolean; Message?: DamiinRow[] }>(
        `${ENDPOINTS.getDamiins}/${suspectId}`,
      );
      if (data?.isError === true || !data?.Message) return [];
      return Array.isArray(data.Message) ? data.Message : [];
    } catch {
      return [];
    }
  },

  async fetchSuspectCases(suspectId: string | number): Promise<SuspectCaseRow[]> {
    try {
      const { data } = await tiphoneApi.get<{ isError?: boolean; Message?: SuspectCaseRow[] }>(
        `${ENDPOINTS.getSuspectCases}/${suspectId}`,
      );
      if (data?.isError === true || !data?.Message) return [];
      return Array.isArray(data.Message) ? data.Message : [];
    } catch {
      return [];
    }
  },

  async fetchResponses(page = 1): Promise<{
    rows: SuspectResponseRow[];
    currentPage: number;
    totalPages: number;
    isError?: boolean;
    message?: string;
  }> {
    const { data } = await tiphoneApi.post<{
      isError?: boolean;
      Message?: SuspectResponseRow[] | string;
      current_page?: number;
      total_pages?: number;
    }>(ENDPOINTS.suspectResponse, { page });

    if (data?.isError) {
      return {
        rows: [],
        currentPage: page,
        totalPages: 1,
        isError: true,
        message: typeof data.Message === "string" ? data.Message : undefined,
      };
    }

    return {
      rows: Array.isArray(data?.Message) ? data.Message : [],
      currentPage: toInt(data?.current_page, page),
      totalPages: Math.max(1, toInt(data?.total_pages, 1)),
      isError: false,
    };
  },

  async fetchResponseComments(responseId: number | string): Promise<ResponseCommentRow[]> {
    const { data } = await tiphoneApi.post<{
      isError?: boolean;
      Message?: ResponseCommentRow[] | string;
    }>(ENDPOINTS.responseComment, { response_id: responseId });
    if (data?.isError) {
      throw new Error(typeof data.Message === "string" ? data.Message : "Faallooyinka lama soo rarin.");
    }
    return Array.isArray(data?.Message) ? data.Message : [];
  },

  async fetchCommentReplies(commentId: number | string): Promise<CommentReplyRow[]> {
    const { data } = await tiphoneApi.post<{
      isError?: boolean;
      Message?: CommentReplyRow[] | string;
    }>(ENDPOINTS.commentReply, { comment_id: commentId });
    if (data?.isError) {
      throw new Error(typeof data.Message === "string" ? data.Message : "Jawaabaha lama soo rarin.");
    }
    return Array.isArray(data?.Message) ? data.Message : [];
  },

  async createComment(
    responseId: number | string,
    userId: number | string,
    comment: string,
  ): Promise<void> {
    const form = new FormData();
    form.append("response_id", String(responseId));
    form.append("user_id", String(userId));
    form.append("comment", comment);
    const { data } = await tiphoneApi.post<{ isError?: boolean; Message?: string }>(
      ENDPOINTS.createSuspectComment,
      form,
      { timeout: 60_000 },
    );
    if (data?.isError) throw new Error(typeof data.Message === "string" ? data.Message : "Failed");
  },

  async createReply(
    commentId: number | string,
    userId: number | string,
    reply: string,
  ): Promise<void> {
    const { data } = await tiphoneApi.post<{ isError?: boolean; Message?: string }>(
      ENDPOINTS.createCommentReply,
      {
        comment_id: commentId,
        commentsReply: reply,
        user_id: String(userId),
      },
    );
    if (data?.isError) throw new Error(typeof data.Message === "string" ? data.Message : "Failed");
  },

  async fetchNotices(dateFilter = ""): Promise<NoticeRow[]> {
    const { data } = await tiphoneApi.post<{ Message?: NoticeRow[] }>(ENDPOINTS.noticeList, {
      dateFilter,
    });
    return Array.isArray(data?.Message) ? data.Message : [];
  },

  async markNoticeRead(tobicId: number): Promise<void> {
    await tiphoneApi.post(ENDPOINTS.updateNoticeStatus, {
      tobic_id: tobicId,
      new_status: 1,
    });
  },

  async fetchDamiinList(params: {
    page?: number;
    searchQuery?: string;
    dateFilter?: string;
  }): Promise<{ rows: DamiinListRow[]; currentPage: number; totalPages: number }> {
    const { data } = await tiphoneApi.post<{
      isError?: boolean;
      Message?: DamiinListRow[];
      current_page?: number;
      total_pages?: number;
    }>(ENDPOINTS.getDamiinList, {
      page: params.page ?? 1,
      searchQuery: params.searchQuery?.trim() ?? "",
      dateFilter: params.dateFilter ?? "",
    });

    if (data?.isError === true) {
      return { rows: [], currentPage: 1, totalPages: 1 };
    }

    return {
      rows: Array.isArray(data?.Message) ? data.Message : [],
      currentPage: data?.current_page ?? params.page ?? 1,
      totalPages: Math.max(1, data?.total_pages ?? 1),
    };
  },

  async fetchDamiinDetail(damiinId: number): Promise<DamiinDetailRow> {
    const { data } = await tiphoneApi.get<{
      isError?: boolean;
      Message?: DamiinDetailRow | string;
    }>(`${ENDPOINTS.getDamiinDetail}/${damiinId}`);
    if (data?.isError || !data?.Message || typeof data.Message === "string") {
      throw new Error(
        typeof data?.Message === "string" ? data.Message : "Faahfaahinta damiinka lama helin.",
      );
    }
    return data.Message;
  },

  async fetchDamiinCases(damiinId: number): Promise<SuspectCaseRow[]> {
    const { data } = await tiphoneApi.get<{
      isError?: boolean;
      Message?: SuspectCaseRow[] | string;
    }>(`${ENDPOINTS.getDamiinCases}/${damiinId}`);
    if (data?.isError) {
      if (typeof data.Message === "string" && /lama helin/i.test(data.Message)) return [];
      throw new Error(
        typeof data.Message === "string" ? data.Message : "Kiisaska damiinka lama helin.",
      );
    }
    return Array.isArray(data?.Message) ? data.Message : [];
  },

  async fetchSuspectReport(params: {
    userId: number | string;
    page?: number;
    searchQuery?: string;
    county?: number | string;
    start?: string;
    end?: string;
  }): Promise<{ rows: SuspectListRow[]; currentPage: number; totalPages: number }> {
    const body: Record<string, unknown> = {
      user_id: params.userId,
      page: params.page ?? 1,
      searchQuery: params.searchQuery?.trim() ?? "",
      county: params.county ?? 0,
    };
    if (params.start) body.start = params.start;
    if (params.end) body.end = params.end;

    const { data } = await tiphoneApi.post<{
      isError?: boolean;
      Message?: Record<string, unknown>[];
      current_page?: number;
      total_pages?: number;
    }>(ENDPOINTS.suspectReport, body);

    if (data?.isError === true) {
      return { rows: [], currentPage: 1, totalPages: 1 };
    }

    return {
      rows: Array.isArray(data?.Message) ? data.Message.map(mapSuspectRow) : [],
      currentPage: toInt(data?.current_page, params.page ?? 1),
      totalPages: Math.max(1, toInt(data?.total_pages, 1)),
    };
  },

  async fetchDistrictPage(
    userId: number | string,
    page = 1,
  ): Promise<{
    districts: {
      id: number;
      name: string;
      img: string;
      user_county: number | string;
      total_suspect: number | string;
      total_cases: number | string;
      daily?: { users: number | string; suspects: number | string; cases: number | string };
      weekly?: { users: number | string; suspects: number | string; cases: number | string };
      monthly?: { users: number | string; suspects: number | string; cases: number | string };
      all?: { users: number | string; suspects: number | string; cases: number | string };
    }[];
    currentPage: number;
    totalPages: number;
  }> {
    const asCount = (v: unknown) =>
      typeof v === "number" || typeof v === "string" ? v : 0;
    const parseBucket = (raw: Record<string, unknown>) => ({
      users: asCount(raw.users ?? raw.user_county ?? raw.user_count),
      suspects: asCount(raw.suspects ?? raw.total_suspect),
      cases: asCount(raw.cases ?? raw.total_cases),
    });
    const normalize = (raw: Record<string, unknown>) => {
      const base = {
        id: toInt(raw.id),
        name: String(raw.name ?? ""),
        img: String(raw.img ?? ""),
        user_county: asCount(raw.user_county ?? raw.user_count),
        total_suspect: asCount(raw.total_suspect),
        total_cases: asCount(raw.total_cases),
        daily: undefined as ReturnType<typeof parseBucket> | undefined,
        weekly: undefined as ReturnType<typeof parseBucket> | undefined,
        monthly: undefined as ReturnType<typeof parseBucket> | undefined,
        all: undefined as ReturnType<typeof parseBucket> | undefined,
      };
      for (const key of ["daily", "weekly", "monthly", "all"] as const) {
        const bucket = raw[key];
        if (bucket && typeof bucket === "object") {
          base[key] = parseBucket(bucket as Record<string, unknown>);
        }
      }
      return base;
    };

    try {
      const { data } = await tiphoneApi.post<Record<string, unknown>>(ENDPOINTS.topAdminPage, {
        user_id: userId,
        page,
      });
      const message = data.Message;
      const districts = Array.isArray(message)
        ? message.map((row) => normalize(row as Record<string, unknown>))
        : message && typeof message === "object"
          ? [normalize(message as Record<string, unknown>)]
          : [];
      return {
        districts,
        currentPage: toInt(data.current_page, page),
        totalPages: Math.max(1, toInt(data.total_pages, 1)),
      };
    } catch {
      return { districts: [], currentPage: 1, totalPages: 1 };
    }
  },

  async fetchDistrictUsers(countyId: number): Promise<DistrictUserRow[]> {
    try {
      const { data } = await tiphoneApi.post<{ Message?: Record<string, unknown>[] }>(
        ENDPOINTS.countyUserData,
        { county_id: countyId },
      );
      if (!Array.isArray(data?.Message)) return [];
      return data.Message.map((r) => ({
        id: toInt(r.id),
        name: String(r.name ?? "—"),
        phone: String(r.phone ?? ""),
        email: String(r.email ?? ""),
        total_suspect: toInt(r.total_suspect, 0),
        lastlogin: resolveLastLoginDisplay(
          r.last_login_at != null ? String(r.last_login_at) : undefined,
          r.lastlogin != null ? String(r.lastlogin) : undefined,
        ),
      }));
    } catch {
      return [];
    }
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await tiphoneApi.post(ENDPOINTS.changePassword, {
      old_password: oldPassword,
      new_password: newPassword,
      model_phone: navigator.userAgent,
      detect_os: navigator.platform,
      ip_address: "",
      get_client_agent: navigator.userAgent,
    });
  },

  async setPin(pin: string, userId?: string | number): Promise<void> {
    await tiphoneApi.post(ENDPOINTS.setPin, {
      pin,
      ...(userId != null ? { user_id: userId } : {}),
    });
  },

  async registerComplete(form: FormData): Promise<{
    ok: boolean;
    message: string;
    caseCode?: string;
    suspectId?: number;
  }> {
    try {
      const { data, status } = await tiphoneApi.post<{
        isError?: boolean;
        Message?: string;
        case_code?: string;
        case_ref?: string;
        suspect_id?: number;
        id?: number;
      }>(ENDPOINTS.registerComplete, form, { timeout: 120_000 });

      if (data?.isError === true) {
        return { ok: false, message: data.Message ?? "Qalad ayaa dhacay" };
      }
      if (status === 201 || status === 200 || data?.isError === false) {
        return {
          ok: true,
          message: typeof data?.Message === "string" ? data.Message : "Waa la diiwaangeliyay",
          caseCode: data?.case_code ?? data?.case_ref,
          suspectId: data?.suspect_id ?? data?.id,
        };
      }
      return { ok: false, message: data?.Message ?? "Qalad ayaa dhacay" };
    } catch (err: unknown) {
      const ax = err as { response?: { data?: Record<string, unknown>; status?: number } };
      const body = ax.response?.data;
      if (body && typeof body === "object") {
        if (typeof body.Message === "string" && body.Message.trim()) {
          return { ok: false, message: body.Message.trim() };
        }
        const fieldMsgs = Object.entries(body)
          .filter(([key, value]) => key !== "isError")
          .flatMap(([, value]) =>
            Array.isArray(value)
              ? value.map(String)
              : typeof value === "string"
                ? [value]
                : [],
          )
          .filter(Boolean);
        if (fieldMsgs.length) return { ok: false, message: fieldMsgs[0] };
      }
      if (ax.response?.status === 403) {
        return { ok: false, message: "Ma haysatid ogolaansho diwaangelinta tuhmane." };
      }
      return { ok: false, message: "Diiwaangelinta way fashilantay. Fadlan isku day mar kale." };
    }
  },

  async submitRegisterComplete(
    draft: SuspectRegisterDraft,
    files: {
      picture?: File | null;
      damiinIdentity?: File | null;
      damiinPicture?: File | null;
    },
  ): Promise<{ ok: boolean; message: string; caseCode?: string; suspectId?: number }> {
    const form = new FormData();
    form.append("fullname", draft.fullname.trim());
    form.append("mother", draft.mother.trim());
    form.append("phone", draft.phone.replace(/\D/g, ""));
    form.append("gender", draft.gender ?? "");
    form.append("identity_card", draft.identityCard.trim());
    form.append("occupation", draft.occupation.trim());
    appendInt(form, "address_county", draft.addressCountyId);
    appendInt(form, "suspect_type", draft.suspectTypeId);
    appendInt(form, "capture_county", draft.captureCountyId);
    appendInt(form, "capture_sub_county", draft.captureSubCountyId);
    form.append("faahfaahin", draft.faahfaahin.trim());
    form.append("doorasho", draft.damiinMode);

    if (draft.damiinMode === "dhamaan_damiin") {
      appendInt(form, "damiin_id", draft.existingDamiinId);
    } else if (draft.damiinMode === "isla_damiin") {
      appendInt(form, "damiin_id", draft.islaDamiinId);
    } else if (draft.damiinMode === "new_damiin") {
      form.append("damiin_name", draft.damiinName.trim());
      form.append("damiin_gender", draft.damiinGender ?? "");
      form.append("damiin_phone", draft.damiinPhone.replace(/\D/g, ""));
      appendInt(form, "relationship", draft.relationshipId);
      appendInt(form, "damiin_county", draft.damiinCountyId);
    }

    if (files.picture) form.append("picture", files.picture);
    if (draft.damiinMode === "new_damiin") {
      if (files.damiinIdentity) form.append("damiin_identity_picture", files.damiinIdentity);
      if (files.damiinPicture) form.append("damiin_picture", files.damiinPicture);
    }

    return TipApi.registerComplete(form);
  },

  async fetchAllDamiins(): Promise<DamiinLookupRow[]> {
    const fromDamiinka = await TipApi.fetchDamiinkaLookup();
    if (fromDamiinka.length > 0) return fromDamiinka;
    try {
      const { data } = await tiphoneApi.get<{ Message?: DamiinLookupRow[] }>(
        ENDPOINTS.getDhamaanDamiins,
      );
      const rows = Array.isArray(data?.Message) ? data.Message : [];
      return rows.filter((r) => r.id && r.name);
    } catch {
      try {
        const { data } = await tiphoneApi.post<{ Message?: DamiinLookupRow[] }>(
          ENDPOINTS.getDhamaanDamiins,
          {},
        );
        const rows = Array.isArray(data?.Message) ? data.Message : [];
        return rows.filter((r) => r.id && r.name);
      } catch {
        return [];
      }
    }
  },

  async fetchIslaDamiinsByPhone(
    phone: string,
    userId: number | string,
  ): Promise<{ id: number; name: string; phone?: string }[]> {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== PHONE_DIGIT_COUNT) return [];
    try {
      const { rows } = await TipApi.fetchSuspectList({
        userId,
        searchQuery: digits,
        page: 1,
      });
      const suspect = rows.find(
        (r) => String(r.tnumber ?? "").replace(/\D/g, "") === digits,
      );
      if (!suspect?.id) return [];
      const damiins = await TipApi.fetchDamiins(String(suspect.id));
      return damiins
        .map((d) => {
          const id = Number(d.damiin_id ?? d.id ?? 0);
          return {
            id,
            name: String(d.name ?? "").trim(),
            phone: d.phone || d.tnumber,
          };
        })
        .filter((r) => r.id > 0 && r.name);
    } catch {
      return [];
    }
  },

  async createExistingCase(form: FormData): Promise<{ ok: boolean; message: string; caseCode?: string }> {
    try {
      const { data, status } = await tiphoneApi.post<{
        isError?: boolean;
        Message?: string;
        case_code?: string;
      }>(ENDPOINTS.createDamiinkaApi, form, { timeout: 120_000 });

      if (data?.isError === true) {
        return { ok: false, message: data.Message ?? "Qalad ayaa dhacay" };
      }
      if (status === 201 || data?.isError === false) {
        return {
          ok: true,
          message: data.Message ?? "Kiiska waa la diiwaan geliyey.",
          caseCode: data.case_code,
        };
      }
      return { ok: false, message: data?.Message ?? "Qalad ayaa dhacay" };
    } catch (err: unknown) {
      const ax = err as { response?: { data?: Record<string, unknown> } };
      const body = ax.response?.data;
      if (body && typeof body === "object") {
        if (typeof body.Message === "string" && body.Message.trim()) {
          return { ok: false, message: body.Message.trim() };
        }
        const fieldMsgs = Object.entries(body)
          .filter(([key, value]) => key !== "isError" && typeof value === "string" && value.trim())
          .map(([, value]) => String(value).trim());
        if (fieldMsgs.length) return { ok: false, message: fieldMsgs.join("\n") };
      }
      return { ok: false, message: "Kiiska lama kaydin karo. Fadlan isku day mar kale." };
    }
  },

  async submitExistingCase(
    draft: ExistingCaseDraft,
    includeCaseFields: boolean,
    userId?: number | string | null,
  ): Promise<{ ok: boolean; message: string; caseCode?: string }> {
    const form = new FormData();
    if (userId != null && String(userId).trim()) {
      form.append("user_id", String(userId));
    }
    form.append("suspect_id", String(draft.suspectId));
    form.append("doorasho", doorashoValue(draft.damiinMode));

    if (includeCaseFields) {
      appendInt(form, "reason", draft.suspectTypeId);
      appendInt(form, "degmada_qabashada", draft.captureCountyId);
      appendInt(form, "sub_county", draft.captureSubCountyId);
      form.append("faahfaahin", draft.faahfaahin.trim());
    }

    if (draft.damiinMode === "dhamaan_damiin") {
      appendInt(form, "damiin_id", draft.existingDamiinId);
    } else if (draft.damiinMode === "isla_damiin") {
      appendInt(form, "damiin_id", draft.islaDamiinId);
    } else {
      form.append("names", draft.damiinName.trim());
      form.append("phone", draft.damiinPhone.replace(/\D/g, ""));
      form.append("gender", draft.damiinGender ?? "");
      appendInt(form, "relationship", draft.relationshipId);
      appendInt(form, "degmada_laga_qabtay", draft.damiinCountyId);
    }

    return TipApi.createExistingCase(form);
  },

  async fetchRelationships(): Promise<Record<string, string>> {
    const rows = await TipApi.fetchRelationshipRows();
    const map: Record<string, string> = {};
    for (const r of rows) map[String(r.id)] = r.name;
    return map;
  },

  async fetchRelationshipRows(): Promise<LookupRow[]> {
    try {
      const { data } = await tiphoneApi.get<{ Message?: { id?: number | string; name?: string }[] }>(
        ENDPOINTS.getRelationships,
      );
      const rows = Array.isArray(data?.Message) ? data.Message : [];
      return rows
        .map((r) => ({ id: r.id ?? "", name: String(r.name ?? "").trim() }))
        .filter((r) => r.name && r.id !== "");
    } catch {
      return [];
    }
  },

  async fetchDamiinkaLookup(params?: {
    searchQuery?: string;
    county?: string;
  }): Promise<DamiinLookupRow[]> {
    const searchQuery = params?.searchQuery ?? "";
    const county = params?.county ?? "dhamaan";
    try {
      const { data } = await tiphoneApi.get<{ Message?: DamiinLookupRow[] }>(
        `${ENDPOINTS.getDamiinka}?searchQuery=${encodeURIComponent(searchQuery)}&county=${encodeURIComponent(county)}`,
      );
      const rows = Array.isArray(data?.Message) ? data.Message : [];
      return rows.filter((r) => r.id && r.name);
    } catch {
      return [];
    }
  },

  filterSubCounties(rows: LookupRow[], countyId: string): LookupRow[] {
    if (!countyId) return [];
    return rows.filter((r) => String(r.cid ?? "") === countyId);
  },

  async fetchSuspectCars(suspectId: string | number): Promise<SuspectVehicle[]> {
    const vehicles: SuspectVehicle[] = [];
    let page = 1;
    let totalPages = 1;
    try {
      while (page <= totalPages && page <= 10) {
        const { data } = await tiphoneApi.post<{
          isError?: boolean;
          Message?: Record<string, unknown>[];
          total_pages?: number;
          current_page?: number;
        }>(ENDPOINTS.suspectCarList, {
          page,
          suspect_id: Number(suspectId),
          searchFilter: "",
        });
        if (data?.isError) break;
        const rows = Array.isArray(data?.Message) ? data.Message : [];
        for (const r of rows) {
          vehicles.push({
            id: toInt(r.id ?? r.car_id, 0),
            make: String(r.car_model ?? r.make ?? r.name ?? "Gaari").trim() || "Gaari",
            plate: String(r.plate_number ?? r.plate ?? r.number_plate ?? "—").trim() || "—",
            detail:
              r.description != null
                ? String(r.description)
                : r.detail != null
                  ? String(r.detail)
                  : r.color != null
                    ? String(r.color)
                    : undefined,
            photoUrl:
              r.photo != null
                ? String(r.photo)
                : r.image != null
                  ? String(r.image)
                  : undefined,
            ownership:
              r.ownership != null
                ? String(r.ownership)
                : r.is_owner != null
                  ? String(r.is_owner)
                  : undefined,
            ownerName:
              r.ownername != null
                ? String(r.ownername)
                : r.owner_name != null
                  ? String(r.owner_name)
                  : undefined,
            ownerPhone:
              r.ownerphone != null
                ? String(r.ownerphone)
                : r.owner_phone != null
                  ? String(r.owner_phone)
                  : undefined,
            latitude: r.latitude != null ? Number(r.latitude) : undefined,
            longitude: r.longitude != null ? Number(r.longitude) : undefined,
            createdAt:
              r.created_at != null
                ? String(r.created_at)
                : r.date != null
                  ? String(r.date)
                  : undefined,
          });
        }
        totalPages = Math.max(1, toInt(data?.total_pages, 1));
        page += 1;
      }
    } catch {
      /* ignore */
    }
    return vehicles.filter((v) => v.id > 0 || v.make);
  },

  async fetchCarModels(): Promise<{ id: number; name: string }[]> {
    const normalize = (data: unknown): { id: number; name: string }[] => {
      let rows: unknown = data;
      if (rows && typeof rows === "object" && !Array.isArray(rows)) {
        const wrapped = rows as { Message?: unknown; message?: unknown };
        if (Array.isArray(wrapped.Message)) rows = wrapped.Message;
        else if (Array.isArray(wrapped.message)) rows = wrapped.message;
      }
      if (!Array.isArray(rows)) return [];
      return rows
        .map((row) => {
          const item = row as { id?: unknown; name?: unknown };
          return { id: toInt(item.id, 0), name: String(item.name ?? "").trim() };
        })
        .filter((row) => row.id > 0 && row.name);
    };

    try {
      const { data } = await tiphoneApi.get(ENDPOINTS.carModalList);
      const rows = normalize(data);
      if (rows.length) return rows;
    } catch {
      /* fall through */
    }
    try {
      const { data } = await tiphoneApi.post(ENDPOINTS.carModalList, {});
      return normalize(data);
    } catch {
      return [];
    }
  },

  async createSuspectCar(payload: {
    suspectId: string | number;
    userId: string | number;
    carModelId: string | number;
    plateNumber: string;
    description: string;
    ownership: "Yes" | "No";
    ownerName?: string;
    ownerPhone?: string;
    photo: File;
    latitude?: number;
    longitude?: number;
  }): Promise<{ ok: boolean; message: string }> {
    try {
      const form = new FormData();
      form.append("user_id", String(payload.userId));
      form.append("suspect", String(payload.suspectId));
      form.append("car_model", String(payload.carModelId));
      form.append("plate_number", payload.plateNumber.trim());
      form.append("description", payload.description.trim());
      form.append("ownership", payload.ownership);
      form.append("ownername", payload.ownerName?.trim() ?? "");
      form.append("ownerphone", (payload.ownerPhone ?? "").replace(/\D/g, ""));
      if (payload.latitude != null && payload.longitude != null) {
        form.append("latitude", String(payload.latitude));
        form.append("longitude", String(payload.longitude));
      }
      form.append("photo", payload.photo);

      const { data } = await tiphoneApi.post<{ isError?: boolean; Message?: string }>(
        ENDPOINTS.createSuspectCar,
        form,
        { timeout: 120_000 },
      );

      if (data?.isError === true) {
        return { ok: false, message: data.Message ?? "Qalad ayaa dhacay" };
      }
      return { ok: true, message: data?.Message ?? "Gaariga waa la diiwaangeliyey" };
    } catch (err) {
      const msg =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { Message?: string } } }).response?.data?.Message ===
          "string"
          ? String((err as { response?: { data?: { Message?: string } } }).response?.data?.Message)
          : "";
      return { ok: false, message: msg || "Fadlan isku day mar kale." };
    }
  },

  async fetchUsers(params: {
    searchQuery?: string;
    countyId?: number;
    page?: number;
    latitude?: number;
    longitude?: number;
    /** Only users within this many km (when lat/lng sent). */
    maxDistanceKm?: number;
  }): Promise<{
    users: ManagedUserRow[];
    currentPage: number;
    totalPages: number;
  }> {
    const body: Record<string, unknown> = {
      searchQuery: params.searchQuery?.trim() ?? "",
      county: params.countyId ?? 0,
      page: params.page ?? 1,
    };
    if (
      params.latitude != null &&
      Number.isFinite(params.latitude) &&
      params.longitude != null &&
      Number.isFinite(params.longitude)
    ) {
      body.latitude = params.latitude;
      body.longitude = params.longitude;
    }
    if (params.maxDistanceKm != null && Number.isFinite(params.maxDistanceKm) && params.maxDistanceKm > 0) {
      body.max_distance_km = params.maxDistanceKm;
    }
    const { data } = await tiphoneApi.post<{
      Message?: Record<string, unknown>[];
      current_page?: number;
      total_pages?: number;
    }>(ENDPOINTS.users, body);
    const rows = Array.isArray(data?.Message) ? data.Message : [];
    return {
      users: rows.map((r) => {
        const distanceRaw = r.distance_km;
        let distanceKm: number | null | undefined;
        if (distanceRaw == null || distanceRaw === "") distanceKm = null;
        else if (typeof distanceRaw === "number" && Number.isFinite(distanceRaw)) distanceKm = distanceRaw;
        else {
          const n = Number(distanceRaw);
          distanceKm = Number.isFinite(n) ? n : null;
        }
        const latRaw = r.latitude;
        const lngRaw = r.longitude;
        const latitude =
          latRaw == null || latRaw === ""
            ? null
            : Number.isFinite(Number(latRaw))
              ? Number(latRaw)
              : null;
        const longitude =
          lngRaw == null || lngRaw === ""
            ? null
            : Number.isFinite(Number(lngRaw))
              ? Number(lngRaw)
              : null;
        return {
          id: toInt(r.id),
          username: String(r.username ?? ""),
          phone: String(r.phone ?? ""),
          email: String(r.email ?? ""),
          county: String(r.county ?? ""),
          lastlogin: String(r.lastlogin ?? r.last_login_at ?? r.last_login ?? ""),
          is_active: r.is_active === true || r.is_active === 1,
          distanceKm,
          isClosest: r.is_closest === true,
          latitude,
          longitude,
        };
      }),
      currentPage: toInt(data?.current_page, 1),
      totalPages: Math.max(1, toInt(data?.total_pages, 1)),
    };
  },

  async fetchAppInstallationDepartments(): Promise<AppInstallationDepartment[]> {
    const { data } = await tiphoneApi.get<{
      Message?: Array<{
        id?: unknown;
        name?: unknown;
        counties?: Array<{ id?: unknown; name?: unknown }>;
      }>;
      isError?: boolean;
    }>(ENDPOINTS.appInstallationDepartments);
    if (data?.isError || !Array.isArray(data?.Message)) return [];
    return data.Message.map((department) => ({
      id: toInt(department.id, 0),
      name: String(department.name ?? ""),
      counties: (department.counties ?? []).map((county) => ({
        id: toInt(county.id, 0),
        name: String(county.name ?? ""),
      })),
    })).filter((department) => department.id > 0);
  },

  async fetchAppInstallationUsers(params: {
    departmentId: number;
    countyId: number;
    searchQuery?: string;
    installationStatus?: "all" | AppInstallationStatus;
    notInstalledReason?: "all" | NotInstalledReason;
    page?: number;
  }): Promise<{
    users: AppInstallationUserRow[];
    summary: AppInstallationSummary;
    currentPage: number;
    totalPages: number;
  }> {
    const { data } = await tiphoneApi.post<{
      Message?: Array<Record<string, unknown>>;
      summary?: {
        total?: unknown;
        installed?: unknown;
        completed?: unknown;
        iphone?: unknown;
        not_installed?: unknown;
      };
      current_page?: unknown;
      total_pages?: unknown;
      isError?: boolean;
    }>(ENDPOINTS.appInstallationUsers, {
      department_id: params.departmentId,
      county_id: params.countyId,
      searchQuery: params.searchQuery?.trim() ?? "",
      installation_status: params.installationStatus ?? "all",
      not_installed_reason: params.notInstalledReason ?? "all",
      page: params.page ?? 1,
    });
    if (data?.isError || !Array.isArray(data?.Message)) {
      throw new Error("Liiska rakibidda lama soo qaadi karin.");
    }
    return {
      users: data.Message.map((row) => ({
        id: toInt(row.id, 0),
        username: String(row.username ?? ""),
        loginUsername: String(row.login_username ?? row.username ?? ""),
        phone: String(row.phone ?? ""),
        email: String(row.email ?? ""),
        county: String(row.county ?? ""),
        employeeNumber: String(row.employee_number ?? ""),
        isActive: row.is_active === true || row.is_active === 1,
        lastlogin: String(row.lastlogin ?? ""),
        groups: Array.isArray(row.groups)
          ? row.groups
              .map((group) => {
                const item = group as Record<string, unknown>;
                return { id: toInt(item.id, 0), name: String(item.name ?? "") };
              })
              .filter((group) => group.id > 0 && group.name)
          : [],
        appInstalled: Boolean(row.app_installed),
        installationStatus: (
          ["completed", "iphone", "not_installed"].includes(
            String(row.installation_status),
          )
            ? String(row.installation_status)
            : row.app_installed
              ? "completed"
              : "not_installed"
        ) as AppInstallationStatus,
        installationLabel:
          row.installation_status === "iphone"
            ? "iPhone"
            : row.app_installed === true
              ? "Loogu shubay"
              : "Looguma shubin",
        notInstalledReason: String(row.not_installed_reason ?? "") as
          | NotInstalledReason
          | "",
        notInstalledReasonLabel: String(row.not_installed_reason_label ?? ""),
        notInstalledReasonDetail: String(row.not_installed_reason_detail ?? ""),
        installedAt: row.installed_at ? String(row.installed_at) : null,
      })),
      summary: {
        total: toInt(data.summary?.total, 0),
        installed: toInt(data.summary?.installed, 0),
        completed: toInt(data.summary?.completed ?? data.summary?.installed, 0),
        iphone: toInt(data.summary?.iphone, 0),
        notInstalled: toInt(data.summary?.not_installed, 0),
      },
      currentPage: toInt(data.current_page, 1),
      totalPages: Math.max(1, toInt(data.total_pages, 1)),
    };
  },

  async updateAppInstallation(
    userId: number,
    status: AppInstallationStatus,
    reason: NotInstalledReason | "" = "",
    reasonDetail = "",
  ): Promise<void> {
    await tiphoneApi.post(ENDPOINTS.appInstallationUpdate, {
      user_id: userId,
      status,
      not_installed_reason: reason,
      not_installed_reason_detail: reasonDetail,
    });
  },

  async fetchPermissionGroups(): Promise<AppPermissionGroup[]> {
    const { data } = await tiphoneApi.get<{
      results?: Array<Record<string, unknown>>;
    }>("/accounts/groups/", { params: { page_size: 200 } });
    return (Array.isArray(data?.results) ? data.results : [])
      .map((row) => ({
        id: toInt(row.id, 0),
        name: String(row.name ?? ""),
        permissionCount: toInt(row.permission_count, 0),
      }))
      .filter((group) => group.id > 0 && group.name);
  },

  async assignPermissionGroups(userId: number, groupIds: number[]): Promise<void> {
    await tiphoneApi.post(`/accounts/users/${userId}/assign_groups/`, {
      group_ids: groupIds,
    });
  },

  async saveUserLocation(userId: number | string, latitude: number, longitude: number): Promise<void> {
    await tiphoneApi.post(ENDPOINTS.saveUserLocation, {
      user_id: userId,
      latitude,
      longitude,
    });
  },

  async updateUserStatus(userId: number, isActive: boolean): Promise<void> {
    await tiphoneApi.post(ENDPOINTS.usersStatus, {
      user_id: userId,
      is_active: isActive ? 1 : 0,
    });
  },

  async bulkUpdateUserStatus(userIds: number[], isActive: boolean): Promise<void> {
    await tiphoneApi.post(ENDPOINTS.usersBulkStatus, {
      user_ids: userIds,
      is_active: isActive ? 1 : 0,
    });
  },

  async resetUserPassword(userId: number): Promise<{
    username?: string;
    password?: string;
    email?: string;
    phone?: string;
  }> {
    const { data } = await tiphoneApi.post<Record<string, unknown>>(ENDPOINTS.resetUserPassword, {
      user_id: userId,
    });
    const message = data.Message;
    if (message && typeof message === "object" && !Array.isArray(message)) {
      const row = message as Record<string, unknown>;
      return {
        username: row.username != null ? String(row.username) : undefined,
        password: row.password != null ? String(row.password) : undefined,
        email: row.email != null ? String(row.email) : undefined,
        phone: row.phone != null ? String(row.phone) : undefined,
      };
    }
    return {
      username: data.username != null ? String(data.username) : undefined,
      password: data.password != null ? String(data.password) : undefined,
      email: data.email != null ? String(data.email) : undefined,
      phone: data.phone != null ? String(data.phone) : undefined,
    };
  },

  async fetchSuspectStatuses(): Promise<{ id: number; name: string }[]> {
    try {
      const { data } = await tiphoneApi.get<{ Message?: { id?: number; name?: string }[] }>(
        ENDPOINTS.getSuspectStatus,
      );
      const rows = Array.isArray(data?.Message) ? data.Message : [];
      return rows
        .map((r) => ({ id: Number(r.id ?? 0), name: String(r.name ?? "") }))
        .filter((r) => r.name);
    } catch {
      return [];
    }
  },

  async fetchAllSubCounties(): Promise<LookupRow[]> {
    try {
      const { data } = await tiphoneApi.get<{
        Message?: { id?: number | string; name?: string; cid?: number | string }[];
      }>(ENDPOINTS.getSubCounty);
      const rows = Array.isArray(data?.Message) ? data.Message : [];
      return rows
        .map((r) => ({
          id: r.id ?? "",
          name: formatCountyLabel(String(r.name ?? "")),
          cid: r.cid,
        }))
        .filter((r) => r.name && r.id !== "");
    } catch {
      return [];
    }
  },

  async fetchSubCounties(countyId: number | string): Promise<{ id: number; name: string }[]> {
    try {
      const { data } = await tiphoneApi.get<{ Message?: { id?: number; name?: string }[] }>(
        `${ENDPOINTS.getSubCounty}?county=${encodeURIComponent(String(countyId))}`,
      );
      const rows = Array.isArray(data?.Message) ? data.Message : [];
      return rows
        .map((r) => ({ id: Number(r.id ?? 0), name: String(r.name ?? "") }))
        .filter((r) => r.name);
    } catch {
      return [];
    }
  },

  async fetchTopUsers(): Promise<{ name: string; county: string; s_count: string | number }[]> {
    const { data } = await tiphoneApi.get<unknown>(ENDPOINTS.topUsers);
    const list = unwrapTopUsersMessage(data);
    if (!list?.length) throw new Error("Top users response invalid");
    return mapTopUsersList(list);
  },

  async fetchAgentLogin(userId?: string | number): Promise<Record<string, unknown>> {
    const { data } = await tiphoneApi.post<Record<string, unknown>>(ENDPOINTS.agentLogin, {
      user_id: userId,
    });
    if (
      data.isError === false &&
      data.Message &&
      typeof data.Message === "object" &&
      !Array.isArray(data.Message)
    ) {
      return data.Message as Record<string, unknown>;
    }
    return data;
  },
};

function asCount(value: unknown): string | number {
  if (typeof value === "number" || typeof value === "string") return value;
  return 0;
}

function coerceToArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return null;
  const values = Object.values(value as Record<string, unknown>);
  if (values.length === 0) return null;
  if (values.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
    return values;
  }
  return null;
}

function unwrapTopUsersMessage(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  let message: unknown = root.Message ?? root.message;
  if (typeof message === "string") {
    const trimmed = message.trim();
    if (trimmed.startsWith("[")) {
      try {
        message = JSON.parse(trimmed);
      } catch {
        return null;
      }
    } else {
      return null;
    }
  }
  return coerceToArray(message) ?? coerceToArray(root.data) ?? coerceToArray(root.results);
}

function mapTopUsersList(list: unknown[]): { name: string; county: string; s_count: string | number }[] {
  const limit = Math.min(list.length, 10);
  const rows: { name: string; county: string; s_count: string | number }[] = [];
  for (let i = 0; i < limit; i++) {
    const item = list[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const raw = item as Record<string, unknown>;
    const name = raw.name != null ? String(raw.name).trim() : "Unknown";
    const county = raw.county != null ? String(raw.county).trim() : "Lama Helin";
    rows.push({
      name: name || "Unknown",
      county: county || "Lama Helin",
      s_count: asCount(raw.s_count ?? 0),
    });
  }
  return rows;
}

function appendInt(form: FormData, key: string, value: string | null | undefined) {
  if (!value?.trim()) return;
  const n = Number(value);
  if (Number.isFinite(n)) form.append(key, String(n));
}

function doorashoValue(mode: DamiinMode): string {
  if (mode === "new_damiin") return "damiin_cusub";
  return mode;
}
