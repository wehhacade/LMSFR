"use client";

import { useEffect, useState } from "react";
import { useLang } from "../lang-ctx";
import { useCounties, useQeybs } from "@/hooks/use-accounts";
import { useCreateTransfer } from "@/hooks/use-personnel";
import { AccountModal, FormField, FormRow, PrimaryButton, SecondaryButton, TextInput, type AccountsThemeColors } from "../accounts-shared";
import type { AgentSummary } from "@/types/agents";

export function TransferFormModal({
  open,
  onClose,
  onSuccess,
  agent,
  C,
  accent,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void | Promise<void>;
  agent: AgentSummary | null;
  C: AccountsThemeColors;
  accent: string;
}) {
  const { lang } = useLang();
  const so = lang === "so";
  const { data: counties = [] } = useCounties();
  const { data: departments = [] } = useQeybs();
  const createTransfer = useCreateTransfer();

  const [toCountyId, setToCountyId] = useState("");
  const [toDepartmentId, setToDepartmentId] = useState("");
  const [reason, setReason] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      setToCountyId("");
      setToDepartmentId("");
      setReason("");
      setNotes("");
      setTransferDate(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!agent || !toCountyId || !reason) return;
    await createTransfer.mutateAsync({
      agent_id: Number(agent.id),
      to_county_id: Number(toCountyId),
      to_department_id: toDepartmentId ? Number(toDepartmentId) : null,
      reason,
      transfer_date: transferDate,
      notes,
    });
    await onSuccess?.();
    onClose();
  };

  return (
    <AccountModal
      open={open}
      onClose={onClose}
      title={so ? "Badal Degmo" : "Transfer Agent"}
      subtitle={agent ? `${agent.personal_fullname || agent.service_id} · ${agent.county_name || "—"}` : ""}
      C={C}
      accent={accent}
      footer={(
        <>
          <SecondaryButton C={C} onClick={onClose}>{so ? "Jooji" : "Cancel"}</SecondaryButton>
          <PrimaryButton accent={accent} onClick={handleSubmit} disabled={!toCountyId || !reason || createTransfer.isPending}>
            {so ? "Badal" : "Transfer"}
          </PrimaryButton>
        </>
      )}
    >
      <FormSection>
        <FormRow>
          <FormField label={so ? "Degmada Hadda" : "Current District"} C={C}>
            <TextInput value={agent?.county_name || "—"} onChange={() => {}} C={C} readOnly />
          </FormField>
          <FormField label={so ? "Degmada Cusub" : "Destination District"} C={C}>
            <select
              value={toCountyId}
              onChange={(e) => setToCountyId(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtPrimary }}
            >
              <option value="">{so ? "Dooro degmo" : "Select district"}</option>
              {counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label={so ? "Qaybta (ikhtiyaari)" : "Section (optional)"} C={C}>
            <select
              value={toDepartmentId}
              onChange={(e) => setToDepartmentId(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtPrimary }}
            >
              <option value="">{so ? "Dooro qayb" : "Select section"}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </FormField>
          <FormField label={so ? "Taariikhda Badalka" : "Transfer Date"} C={C}>
            <TextInput type="date" value={transferDate} onChange={setTransferDate} C={C} />
          </FormField>
        </FormRow>
        <FormField label={so ? "Sababta" : "Reason"} C={C}>
          <TextInput value={reason} onChange={setReason} placeholder={so ? "Sababta badalka" : "Transfer reason"} C={C} />
        </FormField>
        <FormField label={so ? "Qoraal" : "Notes"} C={C}>
          <TextInput value={notes} onChange={setNotes} placeholder={so ? "Ikhtiyaari" : "Optional notes"} C={C} />
        </FormField>
      </FormSection>
    </AccountModal>
  );
}

function FormSection({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>;
}
