"use client";

import { useEffect, useState } from "react";
import { useLang } from "../lang-ctx";
import { useCreateRestriction } from "@/hooks/use-personnel";
import { AccountModal, FormField, FormRow, PrimaryButton, SecondaryButton, TextInput, type AccountsThemeColors } from "../accounts-shared";
import type { AgentSummary } from "@/types/agents";

export function RestrictionFormModal({
  open,
  onClose,
  agent,
  C,
  accent,
}: {
  open: boolean;
  onClose: () => void;
  agent: AgentSummary | null;
  C: AccountsThemeColors;
  accent: string;
}) {
  const { lang } = useLang();
  const so = lang === "so";
  const createRestriction = useCreateRestriction();

  const today = new Date().toISOString().slice(0, 10);
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [idWithheld, setIdWithheld] = useState(true);
  const [weaponWithheld, setWeaponWithheld] = useState(true);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("");
      setStartDate(today);
      setEndDate(today);
      setIdWithheld(true);
      setWeaponWithheld(true);
      setNotes("");
    }
  }, [open, today]);

  const handleSubmit = async () => {
    if (!agent || !reason) return;
    await createRestriction.mutateAsync({
      agent_id: Number(agent.id),
      reason,
      start_date: startDate,
      end_date: endDate,
      id_card_withheld: idWithheld,
      weapon_withheld: weaponWithheld,
      notes,
    });
    onClose();
  };

  return (
    <AccountModal
      open={open}
      onClose={onClose}
      title={so ? "Xayiraad / Fasax" : "Restriction / Leave"}
      subtitle={agent ? `${agent.personal_fullname || agent.service_id}` : ""}
      C={C}
      accent={accent}
      footer={(
        <>
          <SecondaryButton C={C} onClick={onClose}>{so ? "Jooji" : "Cancel"}</SecondaryButton>
          <PrimaryButton accent={accent} onClick={handleSubmit} disabled={!reason || createRestriction.isPending}>
            {so ? "Kaydi" : "Save"}
          </PrimaryButton>
        </>
      )}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FormField label={so ? "Sababta" : "Reason"} C={C}>
          <TextInput value={reason} onChange={setReason} placeholder={so ? "Sababta xayiraadda" : "Restriction reason"} C={C} />
        </FormField>
        <FormRow>
          <FormField label={so ? "Taariikh Bilow" : "Start Date"} C={C}>
            <TextInput type="date" value={startDate} onChange={setStartDate} C={C} />
          </FormField>
          <FormField label={so ? "Taariikh Dhamaad" : "End Date"} C={C}>
            <TextInput type="date" value={endDate} onChange={setEndDate} C={C} />
          </FormField>
        </FormRow>
        <FormRow>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-outfit)", fontSize: 13, color: C.txtSecondary }}>
            <input type="checkbox" checked={idWithheld} onChange={(e) => setIdWithheld(e.target.checked)} />
            {so ? "Ka xir ID/kaarka" : "Withhold ID/card"}
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-outfit)", fontSize: 13, color: C.txtSecondary }}>
            <input type="checkbox" checked={weaponWithheld} onChange={(e) => setWeaponWithheld(e.target.checked)} />
            {so ? "Ka xir Hubka" : "Withhold weapon"}
          </label>
        </FormRow>
        <FormField label={so ? "Qoraal" : "Notes"} C={C}>
          <TextInput value={notes} onChange={setNotes} C={C} />
        </FormField>
      </div>
    </AccountModal>
  );
}
