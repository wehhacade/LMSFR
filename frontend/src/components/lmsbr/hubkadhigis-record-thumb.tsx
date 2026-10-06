"use client";

function initialsFrom(name?: string) {
  return name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function ThumbBox({
  url,
  fallback,
  size,
  border,
  ring,
}: {
  url?: string | null;
  fallback: string;
  size: number;
  border: string;
  ring?: boolean;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        overflow: "hidden",
        border: ring ? `2px solid ${border}` : `1px solid ${border}`,
        background: "#f3f4f6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {url ? (
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontSize: size < 30 ? 10 : 12, fontWeight: 700, color: "#9ca3af" }}>{fallback}</span>
      )}
    </div>
  );
}

/** Person-primary overlap stack — matches mobile list cards. */
export function HubRecordThumbStack({
  weaponUrl,
  personUrl,
  personName,
  size = 44,
  border = "rgba(0,0,0,0.08)",
  layout = "overlap",
}: {
  weaponUrl?: string | null;
  personUrl?: string | null;
  personName?: string;
  size?: number;
  border?: string;
  layout?: "overlap" | "row";
}) {
  const initials = initialsFrom(personName);

  if (layout === "row") {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <ThumbBox url={personUrl} fallback={initials || "Q"} size={size} border={border} />
        <ThumbBox url={weaponUrl} fallback="H" size={size} border={border} />
      </div>
    );
  }

  const weaponSize = Math.round(size * 0.56);
  const wrapSize = size + weaponSize * 0.42;
  return (
    <div style={{ position: "relative", width: wrapSize, height: wrapSize, flexShrink: 0 }}>
      <div style={{ position: "absolute", left: 0, top: 0 }}>
        <ThumbBox url={personUrl} fallback={initials || "Q"} size={size} border={border} />
      </div>
      <div style={{ position: "absolute", right: 0, bottom: 0 }}>
        <ThumbBox url={weaponUrl} fallback="H" size={weaponSize} border={border} ring />
      </div>
    </div>
  );
}
