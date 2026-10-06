import type {
  CommentReplyRow,
  ResponseComment,
  ResponseCommentRow,
  ResponsePost,
  SuspectResponseRow,
} from "./types";
import { formatCountyLabel } from "./utils";

function hashSeed(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) % 1000;
  }
  return h || 1;
}

export function formatResponseDate(value: unknown): string {
  if (value == null || value === "") return "—";
  const raw = String(value);
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  return raw;
}

export function mapResponseRowToPost(row: SuspectResponseRow): ResponsePost {
  const responseId = String(row.response_id ?? row.id);
  const suspectId = String(row.suspect_id ?? row.id);
  const reporter = row.userka?.trim() || row.user_name?.trim() || "Anonymous";
  const district = formatCountyLabel(row.degmo?.trim() || "") || "—";

  return {
    id: responseId,
    suspect: {
      id: suspectId,
      name: row.name?.trim() || "Unknown",
      district,
      photo: row.photo?.trim() || undefined,
      seed: Number(suspectId) % 1000 || hashSeed(suspectId),
      alias: undefined,
    },
    author: {
      name: reporter,
      seed: hashSeed(reporter),
      badge: null,
    },
    when: formatResponseDate(row.tariikhda || row.created_ago || row.created_at),
    description: row.details?.trim() || row.response?.trim() || row.comment?.trim() || "—",
    reactions: { heart: 0 },
    comments: [],
    commentCount: row.howManyComment ?? 0,
    commentsLoaded: false,
  };
}

export function mapCommentRow(row: ResponseCommentRow): ResponseComment {
  const authorName = row.userka?.trim() || "Anonymous";
  const attachments: ResponseComment["attachments"] = [];
  if (row.images?.trim()) {
    attachments.push({ type: "image", dataUrl: row.images.trim() });
  }
  if (row.audio?.trim()) {
    attachments.push({ type: "audio", duration: 30, dataUrl: row.audio.trim() });
  }

  return {
    id: String(row.id),
    author: { name: authorName, seed: hashSeed(authorName), badge: null },
    when: "—",
    text: row.comment?.trim() || undefined,
    attachments: attachments.length ? attachments : undefined,
    reactions: { heart: 0 },
    replies: [],
    replyCount: row.howmanyreplay ?? row.howManyComment ?? 0,
    repliesLoaded: false,
  };
}

export function mapReplyRow(row: CommentReplyRow): ResponseComment {
  const authorName = row.userka?.trim() || "Anonymous";
  return {
    id: `reply-${row.id}`,
    author: { name: authorName, seed: hashSeed(authorName), badge: null },
    when: formatResponseDate(row.tariikhda),
    text: row.details?.trim() || undefined,
    reactions: { heart: 0 },
    replies: [],
  };
}
