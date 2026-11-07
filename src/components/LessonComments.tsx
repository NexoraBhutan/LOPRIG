"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CaretDown, CaretUp, ChatCircleText, Trash } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import UserAvatar from "@/components/UserAvatar";
import { api, errorMessage } from "@/lib/api";
import { timeAgo } from "@/lib/teach";

const BODY_MAX = 2000;

interface LessonComment {
  id: number;
  body: string;
  created_at: string;
  parent: number | null;
  author: { name: string; avatar: string; avatar_color: string; role: string };
  is_instructor: boolean;
  can_delete: boolean;
  replies: LessonComment[];
}

interface CommentList {
  count: number;
  results: LessonComment[];
}

/** Write a comment or a reply. Buttons appear once you start, like most discussion boxes. */
function Composer({
  placeholder,
  autoFocus = false,
  onSubmit,
  onCancel,
  submitLabel = "Comment",
}: {
  placeholder: string;
  autoFocus?: boolean;
  onSubmit: (body: string) => Promise<boolean>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [active, setActive] = useState(autoFocus);
  const [sending, setSending] = useState(false);
  if (!user) return null;

  const text = body.trim();
  const reset = () => {
    setBody("");
    setActive(false);
    onCancel?.();
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text || sending) return;
    setSending(true);
    const ok = await onSubmit(text);
    setSending(false);
    if (ok) reset();
  };

  return (
    <form onSubmit={submit} className="flex gap-3">
      <UserAvatar name={user.name} src={user.avatar} color={user.avatarColor} className="w-9 h-9 text-xs mt-1" />
      <div className="flex-1 min-w-0">
        <textarea
          value={body}
          autoFocus={autoFocus}
          onFocus={() => setActive(true)}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(e);
            if (e.key === "Escape") reset();
          }}
          rows={active ? 3 : 1}
          maxLength={BODY_MAX}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full resize-none bg-transparent border-0 border-b-2 border-line focus:border-ink-strong focus:outline-none py-2 text-sm text-ink-strong placeholder:text-ink-muted transition-colors"
        />
        {active && (
          <div className="flex items-center justify-end gap-2 mt-2">
            {body.length > BODY_MAX * 0.8 && (
              <span className="mr-auto text-xs text-ink-muted tabular-nums">{body.length}/{BODY_MAX}</span>
            )}
            <button type="button" onClick={reset} disabled={sending} className="px-4 py-2 rounded-full text-xs font-bold text-ink-strong bg-transparent border-none hover:bg-bg-soft cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={!text || sending} className="px-4 py-2 rounded-full text-xs font-bold bg-ink-strong text-white border-none cursor-pointer hover:bg-black disabled:bg-bg-sunken disabled:text-ink-muted disabled:cursor-not-allowed transition-colors">
              {sending ? "Posting…" : submitLabel}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  onReply,
  onDelete,
  small = false,
}: {
  comment: LessonComment;
  onReply?: () => void;
  onDelete: (c: LessonComment) => void;
  small?: boolean;
}) {
  const a = comment.author;
  return (
    <div className="flex gap-3">
      <UserAvatar name={a.name} src={a.avatar} color={a.avatar_color} className={small ? "w-7 h-7 text-[0.65rem]" : "w-9 h-9 text-xs"} />
      <div className="flex-1 min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className={`font-bold ${comment.is_instructor ? "bg-ink-strong text-white px-2 py-0.5 rounded-full" : "text-ink-strong"}`}>
            {a.name}
          </span>
          {comment.is_instructor && <span className="font-bold text-gold-dark uppercase tracking-wider text-[0.6rem]">Instructor</span>}
          <time dateTime={comment.created_at} className="text-ink-muted" title={new Date(comment.created_at).toLocaleString()}>
            {timeAgo(comment.created_at)}
          </time>
        </p>
        <p className="mt-1 text-sm text-ink leading-relaxed whitespace-pre-line break-words">{comment.body}</p>
        <div className="flex items-center gap-1 mt-1 -ml-2">
          {onReply && (
            <button type="button" onClick={onReply} className="px-2 py-1 rounded-full text-xs font-bold text-ink-strong bg-transparent border-none hover:bg-bg-soft cursor-pointer">
              Reply
            </button>
          )}
          {comment.can_delete && (
            <button type="button" onClick={() => onDelete(comment)} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold text-ink-muted bg-transparent border-none hover:text-red-600 hover:bg-red-soft cursor-pointer" aria-label="Delete comment">
              <Trash size={13} weight="bold" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The discussion under a lesson: everyone who can watch it can read it; learners in the course post. */
export default function LessonComments({ lessonId, loginHref }: { lessonId: number; loginHref: string }) {
  const { user } = useAuth();
  const { push } = useToast();
  const [data, setData] = useState<CommentList | null>(null);
  const [failed, setFailed] = useState(false);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());

  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    setReplyTo(null);
    setOpen(new Set());
    api<CommentList>(`/learning/lessons/${lessonId}/comments/`)
      .then((res) => alive && setData(res))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [lessonId]);

  const post = async (body: string, parent?: number): Promise<boolean> => {
    try {
      const created = await api<LessonComment>(`/learning/lessons/${lessonId}/comments/`, {
        method: "POST",
        body: { body, parent: parent ?? null },
      });
      setData((d) => {
        if (!d) return d;
        if (!created.parent) return { count: d.count + 1, results: [created, ...d.results] };
        return {
          count: d.count + 1,
          results: d.results.map((c) => (c.id === created.parent ? { ...c, replies: [...c.replies, created] } : c)),
        };
      });
      if (created.parent) setOpen((s) => new Set(s).add(created.parent as number));
      return true;
    } catch (err) {
      push(errorMessage(err), "error");
      return false;
    }
  };

  const remove = async (comment: LessonComment) => {
    if (!window.confirm(comment.replies.length ? "Delete this comment and its replies?" : "Delete this comment?")) return;
    try {
      await api(`/learning/comments/${comment.id}/`, { method: "DELETE" });
      setData((d) => {
        if (!d) return d;
        if (!comment.parent) {
          return { count: d.count - 1 - comment.replies.length, results: d.results.filter((c) => c.id !== comment.id) };
        }
        return {
          count: d.count - 1,
          results: d.results.map((c) => (c.id === comment.parent ? { ...c, replies: c.replies.filter((r) => r.id !== comment.id) } : c)),
        };
      });
    } catch (err) {
      push(errorMessage(err), "error");
    }
  };

  const toggle = (id: number) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="text-lg font-semibold text-ink-strong mb-6">
        {data ? `${data.count} ${data.count === 1 ? "Comment" : "Comments"}` : "Comments"}
      </h2>

      {user ? (
        <Composer placeholder="Add a comment…" onSubmit={(body) => post(body)} />
      ) : (
        <p className="text-sm text-ink-muted bg-white border-2 border-line rounded-xl px-4 py-3">
          <Link href={loginHref} className="font-bold text-gold-dark hover:text-gold">Log in</Link> to ask a question or join the discussion.
        </p>
      )}

      <div className="mt-8 flex flex-col gap-6">
        {failed && <p className="text-sm text-ink-muted">Couldn&apos;t load the comments. Refresh the page to try again.</p>}
        {!data && !failed && <p className="text-sm text-ink-muted">Loading comments…</p>}
        {data && data.results.length === 0 && (
          <div className="flex flex-col items-center text-center py-8 text-ink-muted">
            <ChatCircleText size={32} weight="duotone" className="text-gold-dark mb-2" />
            <p className="text-sm">No comments yet. Ask a question or share what you learned.</p>
          </div>
        )}
        {data?.results.map((c) => {
          const showReplies = open.has(c.id);
          return (
            <div key={c.id}>
              <CommentItem comment={c} onReply={user ? () => setReplyTo(c.id) : undefined} onDelete={remove} />
              <div className="pl-12">
                {replyTo === c.id && (
                  <div className="mt-3">
                    <Composer
                      placeholder={`Reply to ${c.author.name}…`}
                      autoFocus
                      submitLabel="Reply"
                      onSubmit={(body) => post(body, c.id)}
                      onCancel={() => setReplyTo(null)}
                    />
                  </div>
                )}
                {c.replies.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    aria-expanded={showReplies}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 -ml-3 rounded-full text-xs font-bold text-gold-dark bg-transparent border-none hover:bg-gold-soft cursor-pointer"
                  >
                    {showReplies ? <CaretUp size={13} weight="bold" /> : <CaretDown size={13} weight="bold" />}
                    {c.replies.length} {c.replies.length === 1 ? "reply" : "replies"}
                  </button>
                )}
                {showReplies && (
                  <div className="mt-3 flex flex-col gap-4">
                    {c.replies.map((r) => (
                      <CommentItem key={r.id} comment={r} small onReply={user ? () => setReplyTo(c.id) : undefined} onDelete={remove} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
