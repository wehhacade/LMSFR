"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TipApi } from "@/lib/tiphone/api";
import {
  mapCommentRow,
  mapReplyRow,
  mapResponseRowToPost,
} from "@/lib/tiphone/responses-mapper";
import type { ResponsePost } from "@/lib/tiphone/types";

export function useResponsesFeed(userId: number | string | undefined) {
  const [posts, setPosts] = useState<ResponsePost[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const runFetch = useCallback(
    async (targetPage: number, asRefresh = false) => {
      if (!userId || fetchingRef.current) return;
      fetchingRef.current = true;
      if (asRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const result = await TipApi.fetchResponses(targetPage);
        if (result.isError) {
          setError(result.message ?? "Xogta lama soo rarin.");
          setPosts([]);
          return;
        }
        setPosts(result.rows.map(mapResponseRowToPost));
        setPage(result.currentPage);
        setTotalPages(result.totalPages);
      } catch {
        setError("Xogta lama soo rarin. Isku day mar kale.");
        setPosts([]);
      } finally {
        fetchingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void runFetch(1);
  }, [runFetch]);

  const refresh = useCallback(() => runFetch(page, true), [page, runFetch]);

  const nextPage = useCallback(() => {
    if (page < totalPages) void runFetch(page + 1);
  }, [page, totalPages, runFetch]);

  const prevPage = useCallback(() => {
    if (page > 1) void runFetch(page - 1);
  }, [page, runFetch]);

  const loadComments = useCallback(async (postId: string) => {
    try {
      const rows = await TipApi.fetchResponseComments(postId);
      const comments = rows.map(mapCommentRow);
      setPosts((prev) =>
        prev.map((p) =>
          p.id !== postId
            ? p
            : {
                ...p,
                comments,
                commentsLoaded: true,
                commentCount: comments.length,
              },
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Faallooyinka lama soo rarin.");
    }
  }, []);

  const loadReplies = useCallback(async (postId: string, commentId: string) => {
    try {
      const rows = await TipApi.fetchCommentReplies(commentId);
      const replies = rows.map(mapReplyRow);
      setPosts((prev) =>
        prev.map((p) =>
          p.id !== postId
            ? p
            : {
                ...p,
                comments: p.comments.map((c) =>
                  c.id !== commentId
                    ? c
                    : { ...c, replies, repliesLoaded: true, replyCount: replies.length },
                ),
              },
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Jawaabaha lama soo rarin.");
    }
  }, []);

  const submitComment = useCallback(
    async (postId: string, text: string) => {
      if (!userId) return;
      await TipApi.createComment(postId, userId, text);
      await loadComments(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id !== postId
            ? p
            : {
                ...p,
                commentCount: Math.max(p.commentCount ?? 0, p.comments.length) + 1,
              },
        ),
      );
    },
    [loadComments, userId],
  );

  const submitReply = useCallback(
    async (postId: string, commentId: string, text: string) => {
      if (!userId) return;
      await TipApi.createReply(commentId, userId, text);
      await loadReplies(postId, commentId);
    },
    [loadReplies, userId],
  );

  const patchPost = useCallback((postId: string, updater: (post: ResponsePost) => ResponsePost) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? updater(p) : p)));
  }, []);

  return {
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
  };
}
