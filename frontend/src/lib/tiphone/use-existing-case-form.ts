"use client";

import { useCallback, useEffect, useState } from "react";
import { TipApi } from "./api";
import type {
  DamiinLookupRow,
  DamiinMode,
  ExistingCaseDraft,
  LookupRow,
  SuspectCaseRow,
} from "./types";
import {
  damiinLookupLabel,
  formatCountyLabel,
  isValidPhoneDigits,
  phoneValidationMessage,
} from "./utils";

export interface ExistingCaseParams {
  suspectId: number;
  suspectName: string;
  suspectPhone?: string;
  suspectTuhunka?: string;
  userId?: number | string;
}

export interface IslaDamiinOption {
  id: number;
  name: string;
  phone?: string;
}

function normalizeLabel(raw: string): string {
  return formatCountyLabel(String(raw ?? "").trim()).toLowerCase();
}

function matchCountyName(rows: LookupRow[], raw: string | null | undefined): LookupRow | undefined {
  const target = normalizeLabel(String(raw ?? ""));
  if (!target) return undefined;
  return rows.find((r) => normalizeLabel(String(r.name)) === target);
}

function matchStatus(statuses: LookupRow[], label: string | null | undefined): LookupRow | undefined {
  const target = normalizeLabel(String(label ?? ""));
  if (!target) return undefined;
  const exact = statuses.find((s) => normalizeLabel(String(s.name)) === target);
  if (exact) return exact;
  return statuses.find((s) => {
    const name = normalizeLabel(String(s.name));
    return name.includes(target) || target.includes(name);
  });
}

function pickTuhunkaLabel(cases: SuspectCaseRow[], suspectTuhunka?: string): string {
  for (const row of cases) {
    const fromCase = String(row.tuhunka ?? row.Tuhunka ?? "").trim();
    if (fromCase) return fromCase;
  }
  return String(suspectTuhunka ?? "").trim();
}

function resolveCasePatch(
  latest: SuspectCaseRow,
  cases: SuspectCaseRow[],
  counties: LookupRow[],
  subCounties: LookupRow[],
  statuses: LookupRow[],
  suspectTuhunka?: string,
): Partial<ExistingCaseDraft> {
  const countyHit = matchCountyName(counties, latest.d_qabashada);
  const statusHit = matchStatus(statuses, pickTuhunkaLabel(cases, suspectTuhunka));
  const subHit = countyHit
    ? subCounties.find((sc) => {
        if (String(sc.cid ?? "") !== String(countyHit.id)) return false;
        const target = normalizeLabel(String(latest.w_qabashada ?? ""));
        return normalizeLabel(String(sc.name)) === target;
      })
    : undefined;
  const faahfaahin = String(latest.description ?? "").trim() || "—";

  return {
    suspectTypeId: statusHit ? String(statusHit.id) : "",
    captureCountyId: countyHit ? String(countyHit.id) : "",
    captureSubCountyId: subHit ? String(subHit.id) : "",
    faahfaahin,
  };
}

function emptyDraft(params: ExistingCaseParams): ExistingCaseDraft {
  return {
    suspectId: params.suspectId,
    suspectName: params.suspectName,
    suspectPhone: params.suspectPhone,
    suspectTypeId: "",
    captureCountyId: "",
    captureSubCountyId: "",
    faahfaahin: "",
    damiinMode: "new_damiin",
    existingDamiinId: "",
    islaDamiinId: "",
    damiinName: "",
    damiinPhone: "",
    damiinGender: null,
    relationshipId: "",
    damiinCountyId: "",
  };
}

export function useExistingCaseForm(params: ExistingCaseParams) {
  const [draft, setDraft] = useState<ExistingCaseDraft>(() => emptyDraft(params));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [counties, setCounties] = useState<LookupRow[]>([]);
  const [subCounties, setSubCounties] = useState<LookupRow[]>([]);
  const [statuses, setStatuses] = useState<LookupRow[]>([]);
  const [relationships, setRelationships] = useState<LookupRow[]>([]);
  const [allDamiins, setAllDamiins] = useState<DamiinLookupRow[]>([]);
  const [islaDamiins, setIslaDamiins] = useState<IslaDamiinOption[]>([]);
  const [priorCases, setPriorCases] = useState<SuspectCaseRow[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [loadingIslaDamiins, setLoadingIslaDamiins] = useState(true);

  useEffect(() => {
    setDraft(emptyDraft(params));
  }, [params.suspectId, params.suspectName, params.suspectPhone]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, sc, st, rel, all] = await Promise.all([
          TipApi.fetchCounties(),
          TipApi.fetchAllSubCounties(),
          TipApi.fetchSuspectStatuses(),
          TipApi.fetchRelationshipRows(),
          TipApi.fetchDamiinkaLookup(),
        ]);
        if (!alive) return;
        setCounties(c.map((r) => ({ id: r.id, name: formatCountyLabel(r.name) })));
        setSubCounties(sc);
        setStatuses(st.map((r) => ({ id: r.id, name: r.name })));
        setRelationships(rel);
        setAllDamiins(all);
      } finally {
        if (alive) setLoadingLookups(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!params.suspectId) return;
    let alive = true;
    (async () => {
      setLoadingIslaDamiins(true);
      try {
        const suspectKey = String(params.suspectId);
        const [damiinRows, caseRows] = await Promise.all([
          TipApi.fetchDamiins(suspectKey),
          TipApi.fetchSuspectCases(suspectKey),
        ]);
        if (!alive) return;

        setPriorCases(caseRows);

        const rows: IslaDamiinOption[] = damiinRows
          .filter((d) => Number(d.damiin_id ?? d.id ?? 0) > 0)
          .map((d) => ({
            id: Number(d.damiin_id ?? d.id),
            name: String(d.name ?? "").trim(),
            phone: d.phone || d.tnumber,
          }))
          .filter((r) => r.name);

        setIslaDamiins(rows);

        if (rows.length === 1) {
          setDraft((prev) => ({ ...prev, islaDamiinId: String(rows[0].id) }));
        }
      } finally {
        if (alive) setLoadingIslaDamiins(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [params.suspectId]);

  useEffect(() => {
    if (priorCases.length === 0 || counties.length === 0 || statuses.length === 0) return;
    if (islaDamiins.length > 0) return;
    const latest = priorCases[priorCases.length - 1];
    const patch = resolveCasePatch(
      latest,
      priorCases,
      counties,
      subCounties,
      statuses,
      params.suspectTuhunka,
    );
    setDraft((prev) => ({ ...prev, ...patch }));
  }, [priorCases, counties, subCounties, statuses, islaDamiins.length, params.suspectTuhunka]);

  const filteredSubCounties = TipApi.filterSubCounties(subCounties, draft.captureCountyId);

  const setField = useCallback(<K extends keyof ExistingCaseDraft>(key: K, value: ExistingCaseDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }, []);

  const hasPriorDamiins = islaDamiins.length > 0;
  const hasPriorCases = priorCases.length > 0;
  const showCaseSection = hasPriorDamiins;
  const includeCaseFieldsOnSubmit = hasPriorCases;

  const validate = useCallback((): Record<string, string> => {
    const e: Record<string, string> = {};

    if (showCaseSection) {
      if (!draft.suspectTypeId) e.suspectTypeId = "Fadlan dooro tuhunka.";
      if (!draft.captureCountyId) e.captureCountyId = "Fadlan dooro degmada qabashada.";
      if (!draft.captureSubCountyId) e.captureSubCountyId = "Fadlan dooro waaxda qabashada.";
      if (!draft.faahfaahin.trim()) e.faahfaahin = "Fadlan qor faahfaahinta.";
    }

    if (draft.damiinMode === "dhamaan_damiin" && !draft.existingDamiinId) {
      e.existingDamiinId = "Fadlan dooro damiin.";
    } else if (draft.damiinMode === "isla_damiin" && !draft.islaDamiinId) {
      e.islaDamiinId = "Fadlan dooro damiin.";
    } else if (draft.damiinMode === "new_damiin") {
      if (!draft.damiinName.trim()) e.damiinName = "Fadlan qor magaca damiinka.";
      if (!isValidPhoneDigits(draft.damiinPhone)) {
        e.damiinPhone = phoneValidationMessage();
      }
      if (!draft.damiinGender) e.damiinGender = "Fadlan dooro jinsiga.";
      if (!draft.relationshipId) e.relationshipId = "Fadlan dooro xiriirka.";
      if (!draft.damiinCountyId) e.damiinCountyId = "Fadlan dooro degmada.";
    }

    setErrors(e);
    return e;
  }, [draft, showCaseSection]);

  const submit = useCallback(async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      return { ok: false as const, message: "Fadlan buuxi foomka", errors: validationErrors };
    }

    let payload = draft;
    if (includeCaseFieldsOnSubmit && priorCases.length > 0) {
      const latest = priorCases[priorCases.length - 1];
      const patch = resolveCasePatch(
        latest,
        priorCases,
        counties,
        subCounties,
        statuses,
        params.suspectTuhunka,
      );
      if (!showCaseSection) {
        payload = { ...draft, ...patch };
      }
      if (!payload.suspectTypeId?.trim()) {
        return { ok: false as const, message: "Lama helin nooca tuhunka. Fadlan dib u fur boggan." };
      }
      if (!payload.captureCountyId?.trim()) {
        return { ok: false as const, message: "Lama helin degmada qabashada. Fadlan dib u fur boggan." };
      }
      if (!payload.captureSubCountyId?.trim()) {
        return { ok: false as const, message: "Lama helin waaxda qabashada. Fadlan dib u fur boggan." };
      }
    }

    setSubmitting(true);
    try {
      const res = await TipApi.submitExistingCase(payload, includeCaseFieldsOnSubmit, params.userId);
      return res;
    } finally {
      setSubmitting(false);
    }
  }, [
    counties,
    draft,
    includeCaseFieldsOnSubmit,
    priorCases,
    showCaseSection,
    statuses,
    subCounties,
    params.suspectTuhunka,
    params.userId,
    validate,
  ]);

  const setDamiinMode = useCallback(
    (mode: Exclude<DamiinMode, "no_damiin">) => {
      setField("damiinMode", mode);
      setField("existingDamiinId", "");
      setField("islaDamiinId", "");
    },
    [setField],
  );

  return {
    draft,
    errors,
    submitting,
    counties,
    filteredSubCounties,
    statuses,
    relationships,
    allDamiins,
    islaDamiins,
    hasPriorDamiins,
    showCaseSection,
    loadingIslaDamiins,
    damiinOptions: allDamiins.map((d) => damiinLookupLabel(d)),
    loadingLookups,
    setField,
    validate,
    submit,
    setDamiinMode,
  };
}
