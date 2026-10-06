"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Send,
} from "lucide-react";
import { useResponsesFeed } from "@/hooks/use-responses-feed";
import { so } from "@/lib/tiphone/i18n";
import type {
  ResponseAttachment,
  ResponseComment,
  ResponsePost,
  StoredAuth,
  SuspectListRow,
} from "@/lib/tiphone/types";
import { resolveTipMediaUrl } from "@/lib/tiphone/utils";
import { rgba } from "@/lib/tiphone/theme";
import { useTipTheme } from "../theme-provider";
import { AppBarIconButton, ScreenAppBar } from "../app-bar";
import { BottomNav } from "../bottom-nav";
import { TipToast } from "../toast";
import { FeedPostShimmer } from "../shimmer";

function seedTone(seed: number): string {
  const hues = [28, 42, 195, 160, 340, 210, 12, 255];
  const h = hues[Math.abs(seed) % hues.length];
  return `hsl(${h} 38% 38%)`;
}

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function GradAvatar({
  size,
  seed,
  label,
}: {
  size: number;
  seed: number;
  label: string;
}) {
  const { colors } = useTipTheme();
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.32),
        background: `linear-gradient(145deg, ${seedTone(seed)}, ${rgba(colors.goldRgb, 0.55)})`,
        boxShadow: `0 0 0 1.5px ${rgba(colors.goldRgb, 0.25)}`,
      }}
      aria-hidden
    >
      {initials(label)}
    </div>
  );
}

function CommentAttachmentView({ attachment }: { attachment: ResponseAttachment }) {
  const { colors } = useTipTheme();
  if (attachment.type === "image" && attachment.dataUrl) {
    const src = resolveTipMediaUrl(attachment.dataUrl);
    return src ? (
      <img
        src={src}
        alt=""
        className="mt-2 max-h-40 w-full rounded-xl object-cover"
      />
    ) : null;
  }
  if (attachment.type === "audio") {
    return (
      <div
        className="mt-2 rounded-xl px-3 py-2 text-[11px]"
        style={{ background: rgba(colors.goldRgb, 0.1), color: colors.ink1 }}
      >
        🎙 Audio {attachment.duration ? `· ${attachment.duration}s` : ""}
      </div>
    );
  }
  return (
    <div
      className="mt-2 truncate rounded-xl border px-3 py-2 text-[11px]"
      style={{
        background: rgba(colors.goldRgb, 0.08),
        borderColor: rgba(colors.goldRgb, 0.25),
        color: colors.ink0,
      }}
    >
      {attachment.name || "File"}
    </div>
  );
}

function Composer({
  onSend,
  onCancel,
  small,
  placeholder,
}: {
  onSend: (text: string) => void | Promise<void>;
  onCancel?: () => void;
  small?: boolean;
  placeholder?: string;
}) {
  const { colors } = useTipTheme();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="border px-2.5 py-2"
      style={{
        background: rgba(colors.lineRgb, 0.04),
        borderColor: rgba(colors.lineRgb, 0.1),
        borderRadius: small ? 14 : 18,
      }}
    >
      <div className="flex items-end gap-2">
        <GradAvatar size={small ? 24 : 30} seed={6} label={so.you} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder || so.responsesWriteComment}
          rows={1}
          className="min-w-0 flex-1 resize-none bg-transparent text-[13px] outline-none"
          style={{
            color: colors.ink0,
            paddingTop: small ? 5 : 7,
            paddingBottom: small ? 5 : 7,
          }}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!text.trim() || sending}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
          style={{
            background: text.trim()
              ? `linear-gradient(135deg, ${colors.gold2}, ${colors.goldDeep})`
              : rgba(colors.lineRgb, 0.06),
            color: text.trim() ? colors.onGold : colors.ink3,
          }}
          aria-label="Send"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="mt-1.5 text-[10px] font-medium tracking-wide"
          style={{ color: colors.inkMut }}
        >
          CANCEL
        </button>
      ) : null}
    </div>
  );
}

function CommentRow({
  comment,
  onLike,
  onReplyClick,
  isReply,
}: {
  comment: ResponseComment;
  onLike?: () => void;
  onReplyClick?: () => void;
  isReply?: boolean;
}) {
  const { colors } = useTipTheme();
  return (
    <div className="flex gap-2.5">
      <GradAvatar
        size={isReply ? 24 : 30}
        seed={comment.author.seed}
        label={comment.author.name}
      />
      <div className="min-w-0 flex-1">
        <div
          className="rounded-2xl border px-3 py-2"
          style={{
            background: rgba(colors.lineRgb, 0.05),
            borderColor: rgba(colors.lineRgb, 0.08),
          }}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-semibold" style={{ color: colors.ink0 }}>
              {comment.author.name}
            </span>
            {comment.author.badge ? (
              <span
                className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold"
                style={{
                  background: rgba(colors.goldRgb, 0.12),
                  color: colors.gold,
                }}
              >
                {comment.author.badge}
              </span>
            ) : null}
          </div>
          {comment.text ? (
            <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: colors.ink1 }}>
              {comment.text}
            </p>
          ) : null}
          {(comment.attachments || []).map((a, i) => (
            <CommentAttachmentView key={i} attachment={a} />
          ))}
        </div>
        <div className="mt-1 flex items-center gap-3 px-1">
          <span className="text-[10px]" style={{ color: colors.inkMut }}>
            {comment.when}
          </span>
          <button
            type="button"
            onClick={onLike}
            className="flex items-center gap-1 text-[10px] font-medium"
            style={{ color: comment.liked ? colors.rose : colors.inkMut }}
          >
            <Heart size={11} fill={comment.liked ? "currentColor" : "none"} />
            {comment.reactions?.heart ? comment.reactions.heart : so.responsesLike}
          </button>
          {!isReply && onReplyClick ? (
            <button
              type="button"
              onClick={onReplyClick}
              className="text-[10px] font-medium"
              style={{ color: colors.inkMut }}
            >
              {so.responsesReply}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CommentNode({
  comment,
  onLike,
  onLikeReply,
  onReply,
  onLoadReplies,
}: {
  comment: ResponseComment;
  onLike: () => void;
  onLikeReply: (replyId: string) => void;
  onReply: (text: string) => void | Promise<void>;
  onLoadReplies: () => void | Promise<void>;
}) {
  const { colors } = useTipTheme();
  const [replyOpen, setReplyOpen] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const replyCount = comment.repliesLoaded
    ? comment.replies.length
    : (comment.replyCount ?? comment.replies.length);

  const toggleReplies = async () => {
    if (!repliesOpen && !comment.repliesLoaded) {
      await onLoadReplies();
    }
    setRepliesOpen((v) => !v);
  };

  return (
    <div className="space-y-2">
      <CommentRow
        comment={comment}
        onLike={onLike}
        onReplyClick={() => setReplyOpen(true)}
      />
      {replyCount > 0 || replyOpen || repliesOpen ? (
        <div className="ml-4 flex gap-2 pl-1">
          <div
            className="w-0.5 shrink-0 self-stretch rounded-full"
            style={{ background: rgba(colors.lineRgb, 0.1) }}
          />
          <div className="min-w-0 flex-1 space-y-2">
            {replyCount > 0 && !repliesOpen && comment.replies.length === 0 ? (
              <button
                type="button"
                onClick={() => void toggleReplies()}
                className="text-[11px] font-medium"
                style={{ color: colors.gold }}
              >
                {so.responsesShowComments} ({replyCount})
              </button>
            ) : null}
            {repliesOpen
              ? comment.replies.map((r) => (
                  <CommentRow
                    key={r.id}
                    comment={r}
                    isReply
                    onLike={() => onLikeReply(r.id)}
                  />
                ))
              : null}
            {replyOpen ? (
              <Composer
                small
                placeholder={`${so.responsesReplyTo} ${comment.author.name.split(" ")[0]}…`}
                onSend={async (text) => {
                  await onReply(text);
                  setReplyOpen(false);
                  setRepliesOpen(true);
                }}
                onCancel={() => setReplyOpen(false)}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PostCard({
  post,
  expanded,
  onToggleExpand,
  onOpenSuspect,
  onTogglePostHeart,
  onAddComment,
  onAddReply,
  onToggleLike,
  onLoadReplies,
}: {
  post: ResponsePost;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpenSuspect: () => void;
  onTogglePostHeart: () => void;
  onAddComment: (text: string) => void | Promise<void>;
  onAddReply: (commentId: string, text: string) => void | Promise<void>;
  onToggleLike: (commentId: string, isReply: boolean, parentId?: string) => void;
  onLoadReplies: (commentId: string) => void | Promise<void>;
}) {
  const { colors } = useTipTheme();
  const photo = resolveTipMediaUrl(post.suspect.photo);
  const commentTotal = post.commentsLoaded
    ? post.comments.length
    : (post.commentCount ?? post.comments.length);
  const commentLabel = expanded
    ? so.responsesHideComments
    : commentTotal > 0
      ? `${so.responsesShowComments} (${commentTotal})`
      : so.responsesComment;

  return (
    <article
      className="overflow-hidden rounded-[22px] border"
      style={{
        background: rgba(colors.surfRgb, 0.7),
        borderColor: rgba(colors.lineRgb, 0.1),
      }}
    >
      <div className="flex items-start gap-3 px-4 pt-4">
        <GradAvatar size={40} seed={post.author.seed} label={post.author.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13.5px] font-semibold" style={{ color: colors.ink0 }}>
              {post.author.name}
            </span>
            {post.author.badge ? (
              <span
                className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold"
                style={{
                  background: rgba(colors.goldRgb, 0.12),
                  color: colors.gold,
                }}
              >
                {post.author.badge}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            <Clock size={10} style={{ color: colors.inkMut }} />
            <span className="text-[11px]" style={{ color: colors.inkMut }}>
              {post.when}
            </span>
          </div>
        </div>
        <button type="button" className="p-1" aria-label="More" style={{ color: colors.inkMut }}>
          <MoreHorizontal size={18} />
        </button>
      </div>

      <p className="px-4 pt-3 text-[13.5px] leading-relaxed" style={{ color: colors.ink1 }}>
        {post.description}
      </p>

      <button type="button" onClick={onOpenSuspect} className="block w-full px-4 pt-3 text-left">
        <div
          className="overflow-hidden rounded-2xl border"
          style={{
            borderColor: rgba(colors.goldRgb, 0.22),
            background: rgba(colors.surfdRgb, 0.35),
          }}
        >
          <div className="relative aspect-[16/10] w-full">
            {photo ? (
              <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-white/80"
                style={{ background: seedTone(post.suspect.seed) }}
              >
                {initials(post.suspect.name)}
              </div>
            )}
            <div
              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 pt-10"
            >
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-white">
                    {post.suspect.name}
                  </p>
                  {post.suspect.alias && post.suspect.alias !== "—" ? (
                    <p className="truncate text-[11px] italic" style={{ color: colors.gold }}>
                      “{post.suspect.alias}”
                    </p>
                  ) : null}
                  <div className="mt-0.5 flex items-center gap-1">
                    <MapPin size={11} style={{ color: colors.gold }} />
                    <span className="truncate text-[11px] text-white/85">
                      {post.suspect.district}
                    </span>
                  </div>
                </div>
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={{
                    background: `linear-gradient(135deg, ${colors.gold2}, ${colors.goldDeep})`,
                    color: colors.onGold,
                  }}
                >
                  {so.responsesViewSuspect}
                  <ArrowRight size={11} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </button>

      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-1.5">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: "linear-gradient(135deg, #e87b6b, #c75545)" }}
          >
            <Heart size={10} fill="#fff5ed" color="#fff5ed" />
          </span>
          <span className="text-[11px]" style={{ color: colors.inkMut }}>
            {post.reactions.heart}
          </span>
        </div>
        <span className="text-[11px]" style={{ color: colors.inkMut }}>
          {commentTotal} {so.responsesComments}
        </span>
      </div>

      <div
        className="mt-2 flex border-t"
        style={{ borderColor: rgba(colors.lineRgb, 0.07) }}
      >
        <button
          type="button"
          onClick={onTogglePostHeart}
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium"
          style={{ color: post.liked ? colors.rose : colors.ink2 }}
        >
          <Heart size={16} fill={post.liked ? "currentColor" : "none"} />
          {so.responsesReact}
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium"
          style={{ color: colors.ink2 }}
        >
          <MessageCircle size={16} />
          {commentLabel}
        </button>
      </div>

      {expanded && post.comments.length > 0 ? (
        <div
          className="space-y-3 border-t px-4 py-3"
          style={{ borderColor: rgba(colors.lineRgb, 0.07) }}
        >
          {post.comments.map((c) => (
            <CommentNode
              key={c.id}
              comment={c}
              onLike={() => onToggleLike(c.id, false)}
              onLikeReply={(rid) => onToggleLike(rid, true, c.id)}
              onReply={(text) => onAddReply(c.id, text)}
              onLoadReplies={() => onLoadReplies(c.id)}
            />
          ))}
        </div>
      ) : null}

      {expanded ? (
        <div
          className="px-4 pb-4"
          style={
            post.comments.length === 0
              ? {
                  borderTop: `1px solid ${rgba(colors.lineRgb, 0.07)}`,
                  paddingTop: 12,
                }
              : undefined
          }
        >
          <Composer onSend={onAddComment} />
        </div>
      ) : null}
    </article>
  );
}

function postToSuspectRow(post: ResponsePost): SuspectListRow {
  return {
    id: Number(post.suspect.id) || 0,
    name: post.suspect.name,
    photo: post.suspect.photo,
    degmada: post.suspect.district,
    nickname: post.suspect.alias,
  };
}

export function ResponsesScreen({
  auth,
  onOpenDrawer,
  onTab,
  onOpenProfile,
}: {
  auth: StoredAuth;
  onOpenDrawer: () => void;
  onTab: (t: "home" | "suspects" | "responses") => void;
  onOpenProfile?: (s: SuspectListRow) => void;
}) {
  const { colors } = useTipTheme();
  const {
    posts,
    page,
    totalPages,
    loading,
    refreshing,
    error,
    refresh,
    nextPage,
    prevPage,
    loadComments,
    loadReplies,
    submitComment,
    submitReply,
    patchPost,
    setError,
  } = useResponsesFeed(auth.user.id);

  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<{
    kind?: "success" | "error" | "info";
    title: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    if (error) {
      setToast({ kind: "info", title: so.responsesTitle, message: error });
      setError(null);
    }
  }, [error, setError]);

  const totalResponses = useMemo(
    () => posts.reduce((n, p) => n + (p.commentCount ?? p.comments.length), 0),
    [posts],
  );

  const togglePost = useCallback(
    (id: string) => {
      setExpandedPosts((prev) => {
        const next = new Set(prev);
        const opening = !next.has(id);
        if (opening) {
          next.add(id);
          void loadComments(id);
        } else {
          next.delete(id);
        }
        return next;
      });
    },
    [loadComments],
  );

  const addComment = useCallback(
    async (postId: string, text: string) => {
      if (!text.trim()) return;
      try {
        await submitComment(postId, text.trim());
        setExpandedPosts((prev) => new Set(prev).add(postId));
        setToast({ kind: "success", title: "Guul", message: "Faallada waa la diray." });
      } catch (e) {
        setToast({
          kind: "error",
          title: "Qalad",
          message: e instanceof Error ? e.message : "Faallada lama dirin.",
        });
      }
    },
    [submitComment],
  );

  const addReply = useCallback(
    async (postId: string, commentId: string, text: string) => {
      if (!text.trim()) return;
      try {
        await submitReply(postId, commentId, text.trim());
        setToast({ kind: "success", title: "Guul", message: "Jawaabta waa la diray." });
      } catch (e) {
        setToast({
          kind: "error",
          title: "Qalad",
          message: e instanceof Error ? e.message : "Jawaabta lama dirin.",
        });
      }
    },
    [submitReply],
  );

  const toggleLike = useCallback(
    (postId: string, commentId: string, isReply: boolean, parentId?: string) => {
      patchPost(postId, (p) => ({
        ...p,
        comments: p.comments.map((c) => {
          if (!isReply && c.id === commentId) {
            return {
              ...c,
              liked: !c.liked,
              reactions: { heart: (c.reactions?.heart || 0) + (c.liked ? -1 : 1) },
            };
          }
          if (isReply && c.id === parentId) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id !== commentId
                  ? r
                  : {
                      ...r,
                      liked: !r.liked,
                      reactions: { heart: (r.reactions?.heart || 0) + (r.liked ? -1 : 1) },
                    },
              ),
            };
          }
          return c;
        }),
      }));
    },
    [patchPost],
  );

  const togglePostHeart = useCallback(
    (postId: string) => {
      patchPost(postId, (p) => ({
        ...p,
        liked: !p.liked,
        reactions: {
          ...p.reactions,
          heart: p.reactions.heart + (p.liked ? -1 : 1),
        },
      }));
    },
    [patchPost],
  );

  return (
    <div className="flex min-h-dvh flex-col pb-24">
      {toast ? <TipToast {...toast} onClose={() => setToast(null)} /> : null}

      <ScreenAppBar
        showBack={false}
        title={
          <span style={{ color: colors.ink0 }}>
            {so.navResponses}
          </span>
        }
        onMenu={onOpenDrawer}
        right={
          <div className="relative">
            <AppBarIconButton onClick={() => undefined} label="Ogeysiisyo">
              <Bell size={18} />
            </AppBarIconButton>
            <span
              className="absolute right-1 top-1 h-2 w-2 rounded-full border"
              style={{ background: colors.green, borderColor: colors.bg1 }}
            />
          </div>
        }
      />

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-2">
        {loading && !refreshing ? (
          <FeedPostShimmer count={4} />
        ) : (
          <>
            {posts.length > 0 ? (
              <div className="mb-3 flex items-center gap-2 px-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: colors.green }}
                />
                <span className="text-[11px] font-medium" style={{ color: colors.inkMut }}>
                  {posts.length} falcelin · {totalResponses} faallo
                </span>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  disabled={refreshing}
                  className="ml-auto text-[11px] font-medium"
                  style={{ color: colors.gold }}
                >
                  {refreshing ? "…" : so.suspectsRefresh}
                </button>
              </div>
            ) : null}

            {posts.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <MessageCircle size={48} style={{ color: rgba(colors.goldRgb, 0.45) }} />
                <p className="mt-4 text-[16px] font-semibold" style={{ color: colors.ink0 }}>
                  {so.responsesEmptyTitle}
                </p>
                <p className="mt-1 text-[13px]" style={{ color: colors.ink2 }}>
                  {so.responsesEmptySub}
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {posts.map((item) => (
                  <PostCard
                    key={item.id}
                    post={item}
                    expanded={expandedPosts.has(item.id)}
                    onToggleExpand={() => togglePost(item.id)}
                    onOpenSuspect={() => onOpenProfile?.(postToSuspectRow(item))}
                    onTogglePostHeart={() => togglePostHeart(item.id)}
                    onAddComment={(text) => addComment(item.id, text)}
                    onAddReply={(commentId, text) => addReply(item.id, commentId, text)}
                    onToggleLike={(commentId, isReply, parentId) =>
                      toggleLike(item.id, commentId, isReply, parentId)
                    }
                    onLoadReplies={(commentId) => loadReplies(item.id, commentId)}
                  />
                ))}
              </div>
            )}

            {totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-center gap-4 pb-4">
                <button
                  type="button"
                  onClick={prevPage}
                  disabled={page <= 1}
                  className="flex h-9 w-9 items-center justify-center rounded-full border disabled:opacity-35"
                  style={{
                    borderColor: rgba(colors.lineRgb, 0.12),
                    color: colors.gold,
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[13px] font-medium" style={{ color: colors.ink0 }}>
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={nextPage}
                  disabled={page >= totalPages}
                  className="flex h-9 w-9 items-center justify-center rounded-full border disabled:opacity-35"
                  style={{
                    borderColor: rgba(colors.lineRgb, 0.12),
                    color: colors.gold,
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : (
              <div className="h-2" />
            )}
          </>
        )}
      </div>

      <BottomNav active="responses" onSelect={onTab} />
    </div>
  );
}
