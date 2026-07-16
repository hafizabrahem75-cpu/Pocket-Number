import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMessageThread,
  useSendMessage,
  useDeleteMessage,
  useUpdateMessageStatus,
  useGetUserById,
  getGetUserByIdQueryKey,
  getGetInboxQueryKey,
  getGetMessageThreadQueryKey,
  getMessageThread,
} from "@workspace/api-client-react";
import type { MessageItem } from "@workspace/api-client-react";
import type { ChatTarget } from "@/contexts/ChatLauncherContext";
import { useCallLauncher } from "@/contexts/CallLauncherContext";
import { ChevronRight, Send, Loader2, Trash2, CheckCheck, Clock, ArrowDown, AlertCircle, RotateCcw, X, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatLastSeen(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "آخر ظهور منذ لحظات";
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `آخر ظهور منذ ${mins} ${mins === 1 ? "دقيقة" : "دقائق"}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `آخر ظهور منذ ${hours} ${hours === 1 ? "ساعة" : "ساعات"}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `آخر ظهور منذ ${days} ${days === 1 ? "يوم" : "أيام"}`;
  return `آخر ظهور ${new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}`;
}

// ── Peer presence indicator ───────────────────────────────────────────────────

function PeerPresence({
  isOnline,
  lastSeenAt,
}: {
  isOnline: boolean;
  lastSeenAt: string | null | undefined;
}) {
  if (isOnline) {
    return (
      <span className="flex items-center gap-1">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" />
        <span>متصل الآن</span>
      </span>
    );
  }
  if (lastSeenAt) {
    return <span>{formatLastSeen(lastSeenAt)}</span>;
  }
  return null;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "اليوم";
  if (d.toDateString() === yesterday.toDateString()) return "أمس";
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "long" });
}

function groupByDay(messages: MessageItem[]): { day: string; msgs: MessageItem[] }[] {
  const map: Record<string, MessageItem[]> = {};
  for (const m of messages) {
    const key = new Date(m.createdAt).toDateString();
    if (!map[key]) map[key] = [];
    map[key].push(m);
  }
  return Object.entries(map).map(([, msgs]) => ({
    day: formatDay(msgs[0].createdAt),
    msgs,
  }));
}

// ── Long-press hook ───────────────────────────────────────────────────────────
// Works on both touch (mobile) and mouse (desktop). Cancels if the pointer
// moves more than a small threshold — so normal scrolling is never blocked.

function useLongPress(callback: () => void, ms = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressing, setPressing] = useState(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const start = useCallback(
    (x: number, y: number) => {
      startPos.current = { x, y };
      setPressing(true);
      timerRef.current = setTimeout(() => {
        setPressing(false);
        callback();
      }, ms);
    },
    [callback, ms],
  );

  const cancel = useCallback(() => {
    setPressing(false);
    startPos.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onMove = useCallback(
    (x: number, y: number) => {
      if (!startPos.current) return;
      const dx = Math.abs(x - startPos.current.x);
      const dy = Math.abs(y - startPos.current.y);
      if (dx > 8 || dy > 8) cancel();
    },
    [cancel],
  );

  return {
    pressing,
    handlers: {
      onMouseDown: (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        start(e.clientX, e.clientY);
      },
      onMouseUp: cancel,
      onMouseLeave: cancel,
      onMouseMove: (e: React.MouseEvent) => onMove(e.clientX, e.clientY),
      onTouchStart: (e: React.TouchEvent) => {
        const t = e.touches[0];
        start(t.clientX, t.clientY);
      },
      onTouchEnd: cancel,
      onTouchMove: (e: React.TouchEvent) => {
        const t = e.touches[0];
        onMove(t.clientX, t.clientY);
      },
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}

// ── Status ticks ─────────────────────────────────────────────────────────────

function StatusTick({
  status,
  isPending,
  isFailed,
}: {
  status: MessageItem["status"];
  isPending?: boolean;
  isFailed?: boolean;
}) {
  if (isFailed)
    return <AlertCircle className="w-3 h-3 text-red-300 shrink-0" />;
  if (isPending)
    return <Loader2 className="w-3 h-3 text-primary-foreground/50 shrink-0 animate-spin" />;
  if (status === "sent")
    return <Clock className="w-3 h-3 text-primary-foreground/50 shrink-0" />;
  if (status === "delivered")
    return <CheckCheck className="w-3.5 h-3.5 text-primary-foreground/70 shrink-0" />;
  return <CheckCheck className="w-3.5 h-3.5 text-blue-200 shrink-0" />;
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isMine,
  isPending,
  isFailed,
  onLongPress,
  onRetry,
}: {
  msg: MessageItem;
  isMine: boolean;
  isPending?: boolean;
  isFailed?: boolean;
  onLongPress?: () => void;
  onRetry?: () => void;
}) {
  const { pressing, handlers } = useLongPress(onLongPress ?? (() => {}));
  const isInteractive = !!onLongPress;

  if (msg.deletedAt) {
    return (
      <div className={cn("flex", isMine ? "justify-start" : "justify-end")}>
        <p className="text-xs text-muted-foreground italic px-3 py-1.5 bg-muted/40 rounded-2xl">
          تم سحب هذه الرسالة
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-end gap-1.5",
        isMine ? "justify-start" : "justify-end",
      )}
    >
      <div
        {...(isInteractive ? handlers : {})}
        className={cn(
          "max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words transition-all duration-100 select-none",
          isInteractive && "cursor-pointer",
          pressing && "scale-95 brightness-90",
          isPending && !isFailed && "opacity-60",
          isFailed
            ? "bg-red-500/80 text-white rounded-tl-sm"
            : isMine
              ? "bg-primary text-primary-foreground rounded-tl-sm"
              : "bg-card border border-border text-foreground rounded-tr-sm shadow-sm",
        )}
      >
        <p className="whitespace-pre-wrap">{msg.content}</p>
        <div
          className={cn(
            "flex items-center gap-1 mt-0.5",
            isMine ? "justify-start" : "justify-end",
          )}
        >
          {isFailed && onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 text-[10px] text-white/80 hover:text-white transition-colors"
              aria-label="إعادة الإرسال"
            >
              <RotateCcw className="w-3 h-3" />
              <span>إعادة</span>
            </button>
          )}
          <span
            className={cn(
              "text-[10px] leading-none",
              isMine ? "text-primary-foreground/60" : "text-muted-foreground",
              isFailed && "text-white/60",
            )}
          >
            {formatTime(msg.createdAt)}
          </span>
          {isMine && <StatusTick status={msg.status} isPending={isPending} isFailed={isFailed} />}
        </div>
      </div>
    </div>
  );
}

// ── Day divider ───────────────────────────────────────────────────────────────

function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[11px] text-muted-foreground font-medium px-1">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── Message action sheet ──────────────────────────────────────────────────────

function MessageActionSheet({
  open,
  onRetract,
  onClose,
}: {
  open: boolean;
  onRetract: () => void;
  onClose: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end max-w-[428px] mx-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet panel */}
      <div className="relative bg-card rounded-t-2xl shadow-xl animate-in slide-in-from-bottom-4 duration-250 pb-safe">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-muted-foreground/25" />
        </div>

        <div className="px-4 pt-2 pb-4 space-y-1">
          {/* Retract action */}
          <button
            onClick={() => {
              onClose();
              onRetract();
            }}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-destructive hover:bg-destructive/8 active:bg-destructive/15 transition-colors text-sm font-medium"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span>سحب الرسالة</span>
          </button>

          {/* Divider */}
          <div className="h-px bg-border mx-1" />

          {/* Cancel */}
          <button
            onClick={onClose}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-muted-foreground hover:bg-muted/60 active:bg-muted transition-colors text-sm font-medium"
          >
            <X className="w-4 h-4 shrink-0" />
            <span>إلغاء</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConversationView({
  peer,
  onBack,
}: {
  peer: ChatTarget;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { startCall } = useCallLauncher();
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [olderMessages, setOlderMessages] = useState<MessageItem[]>([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const markedReadIds = useRef(new Set<number>());

  // ── Action sheet state ────────────────────────────────────────────────────
  // Stores the id of the message the user long-pressed; null = sheet closed.
  const [actionSheetMsgId, setActionSheetMsgId] = useState<number | null>(null);

  // ── Optimistic send state ──────────────────────────────────────────────────
  // Each entry represents one in-flight (or just-confirmed) send. `message.id`
  // is a negative temp id while pending, and becomes the real server id once
  // the API confirms — it is pruned once the polled thread data includes that
  // real id, so it never sticks around as a duplicate.
  // `status` is 'pending' while in-flight and 'failed' when the send errored —
  // failed entries are kept so the user can retry without losing the text.
  interface PendingEntry {
    tempId: number;
    message: MessageItem;
    status: "pending" | "failed";
  }
  const [pendingMessages, setPendingMessages] = useState<PendingEntry[]>([]);

  const myId = user?.id ?? 0;

  // ── Peer presence (polls every 30 s) ─────────────────────────────────────
  const { data: peerProfile } = useGetUserById(peer.peerId, {
    query: {
      queryKey: getGetUserByIdQueryKey(peer.peerId),
      refetchInterval: 30_000,
      staleTime: 0,
    },
  });

  // ── Pagination state (tracks cursor/hasMore from each loadMore response) ──
  const [paginationState, setPaginationState] = useState<{
    nextCursor: number | null;
    hasMore: boolean;
    initialized: boolean;
  }>({ nextCursor: null, hasMore: false, initialized: false });

  // ── Live thread query (polls every 4s, no cursor — always latest 50) ──────
  const { data: threadData, isLoading: threadLoading } = useGetMessageThread(
    { recipientId: peer.peerId },
    {
      query: {
        queryKey: getGetMessageThreadQueryKey({ recipientId: peer.peerId }),
        refetchInterval: 4_000,
        staleTime: 0,
      },
    },
  );

  // Memoized so the reference is stable across renders when the underlying
  // data hasn't changed — otherwise effects keyed on `liveMessages` would
  // re-fire every render (since `threadData?.messages ?? []` would create a
  // brand new array each time) and risk an infinite update loop.
  const liveMessages = useMemo(() => threadData?.messages ?? [], [threadData]);

  // Seed pagination state from the first live response (only once)
  useEffect(() => {
    if (!paginationState.initialized && threadData) {
      setPaginationState({
        nextCursor: threadData.nextCursor ?? null,
        hasMore: threadData.hasMore ?? false,
        initialized: true,
      });
    }
  }, [threadData, paginationState.initialized]);

  // Merge older (paginated) + live + optimistic sends, dedup by id, sort by
  // createdAt ascending. Optimistic entries only fill in when their id isn't
  // already covered by live/older data, so once the server-confirmed message
  // shows up via polling, the real one wins and the optimistic copy is a no-op.
  const allMessages = useCallback(() => {
    const map = new Map<number, MessageItem>();
    for (const m of olderMessages) map.set(m.id, m);
    for (const m of liveMessages) map.set(m.id, m);
    for (const p of pendingMessages) {
      if (!map.has(p.message.id)) map.set(p.message.id, p.message);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [olderMessages, liveMessages, pendingMessages])();

  // Once a confirmed send's real id shows up in the live/polled thread data,
  // its pending entry is no longer needed — drop it to avoid unbounded growth.
  useEffect(() => {
    setPendingMessages((prev) => {
      const next = prev.filter(
        (p) => p.message.id < 0 || !liveMessages.some((m: MessageItem) => m.id === p.message.id),
      );
      // Bail out without creating a new array when nothing was actually
      // pruned — otherwise this would set state (and re-render) every time
      // the effect runs, even when there is nothing to prune.
      return next.length === prev.length ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMessages]);

  // ── Mark delivered messages as read when conversation is visible ──────────
  const updateStatus = useUpdateMessageStatus();

  // A stable string key whose value changes whenever the exact set of
  // delivered-to-me message IDs changes — including the race condition where
  // a retracted message and a newly-delivered message cancel out and leave the
  // total count unchanged.  Using only `allMessages.length` as a dependency
  // misses that case because the count stays the same while a different message
  // enters the "delivered" set.
  const deliveredToMeKey = allMessages
    .filter((m) => m.recipientId === myId && m.status === "delivered")
    .map((m) => m.id)
    .join(",");

  useEffect(() => {
    for (const m of allMessages) {
      if (m.recipientId === myId && m.status === "delivered" && !markedReadIds.current.has(m.id)) {
        markedReadIds.current.add(m.id);
        updateStatus.mutate(
          { id: m.id, data: { status: "read" } },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey() });
              queryClient.invalidateQueries({
                queryKey: getGetMessageThreadQueryKey({ recipientId: peer.peerId }),
              });
            },
            onError: () => {
              // Remove from set so the next render cycle can retry
              markedReadIds.current.delete(m.id);
            },
          },
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveredToMeKey]);

  // ── Scroll to bottom on open and on new messages ──────────────────────────
  const scrollToBottom = (smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  };

  useEffect(() => {
    scrollToBottom();
  }, []);

  // Scroll to bottom when new live messages arrive (only if already near bottom)
  const prevLiveCount = useRef(0);
  useEffect(() => {
    if (liveMessages.length > prevLiveCount.current) {
      const list = listRef.current;
      if (list) {
        const distFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
        if (distFromBottom < 120) scrollToBottom(true);
      }
      prevLiveCount.current = liveMessages.length;
    }
  }, [liveMessages.length]);

  // Show "scroll to bottom" button when user scrolled up
  const handleScroll = () => {
    const list = listRef.current;
    if (!list) return;
    const distFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    setShowScrollBtn(distFromBottom > 200);
  };

  // ── Load more (older messages) ────────────────────────────────────────────
  const [loadingMore, setLoadingMore] = useState(false);
  const { hasMore, nextCursor } = paginationState;

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await getMessageThread({ recipientId: peer.peerId, before: nextCursor });
      setOlderMessages((prev) => {
        const map = new Map<number, MessageItem>();
        for (const m of data.messages) map.set(m.id, m);
        for (const m of prev) map.set(m.id, m);
        return Array.from(map.values());
      });
      // Advance cursor from this response so repeated "load more" works
      setPaginationState({
        nextCursor: data.nextCursor ?? null,
        hasMore: data.hasMore ?? false,
        initialized: true,
      });
      setCursor(nextCursor);
    } catch {
      toast({ variant: "destructive", title: "تعذّر تحميل المزيد" });
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const send = useSendMessage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const tempIdCounter = useRef(0);

  const handleSend = () => {
    const content = text.trim();
    if (!content) return;
    setText("");
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // 1. Optimistic: show the message immediately with a pending indicator.
    // Negative ids can never collide with real (serial, positive) server ids.
    tempIdCounter.current -= 1;
    const tempId = tempIdCounter.current;
    const now = new Date().toISOString();
    const tempMessage: MessageItem = {
      id: tempId,
      senderId: myId,
      recipientId: peer.peerId,
      content,
      contentType: "text/plain",
      contentIv: null,
      contentTag: null,
      senderPublicKey: null,
      status: "sent",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    setPendingMessages((prev) => [...prev, { tempId, message: tempMessage, status: "pending" }]);
    scrollToBottom(true);

    send.mutate(
      { data: { recipientId: peer.peerId, content } },
      {
        onSuccess: (serverMessage: MessageItem) => {
          // 2. Replace the temporary message with the real one from the server,
          // keeping its actual status. It stays in `pendingMessages` (now keyed
          // by the real id) until the polled thread confirms it, then gets pruned.
          setPendingMessages((prev) =>
            prev.map((p) =>
              p.tempId === tempId ? { tempId, message: serverMessage, status: "pending" as const } : p,
            ),
          );
          queryClient.invalidateQueries({
            queryKey: getGetMessageThreadQueryKey({ recipientId: peer.peerId }),
          });
          queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey() });
          scrollToBottom(true);
        },
        onError: () => {
          // 3. Mark as failed — keep the message visible so the user can retry.
          setPendingMessages((prev) =>
            prev.map((p) => (p.tempId === tempId ? { ...p, status: "failed" as const } : p)),
          );
          toast({
            variant: "destructive",
            title: "تعذّر الإرسال",
            description: "حدث خطأ غير متوقع، اضغط إعادة للمحاولة",
          });
        },
      },
    );
  };

  // ── Retry a failed send ───────────────────────────────────────────────────
  const handleRetry = (tempId: number) => {
    const entry = pendingMessages.find((p) => p.tempId === tempId);
    if (!entry) return;
    const content = entry.message.content;

    // Flip back to pending so the spinner shows again
    setPendingMessages((prev) =>
      prev.map((p) => (p.tempId === tempId ? { ...p, status: "pending" as const } : p)),
    );

    send.mutate(
      { data: { recipientId: peer.peerId, content } },
      {
        onSuccess: (serverMessage: MessageItem) => {
          setPendingMessages((prev) =>
            prev.map((p) =>
              p.tempId === tempId ? { tempId, message: serverMessage, status: "pending" as const } : p,
            ),
          );
          queryClient.invalidateQueries({
            queryKey: getGetMessageThreadQueryKey({ recipientId: peer.peerId }),
          });
          queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey() });
          scrollToBottom(true);
        },
        onError: () => {
          setPendingMessages((prev) =>
            prev.map((p) => (p.tempId === tempId ? { ...p, status: "failed" as const } : p)),
          );
          toast({
            variant: "destructive",
            title: "تعذّر الإرسال مجدداً",
            description: "حدث خطأ غير متوقع، اضغط إعادة للمحاولة",
          });
        },
      },
    );
  };

  // Auto-resize textarea
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  // Send on Enter (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Soft-delete (retract) ─────────────────────────────────────────────────
  const del = useDeleteMessage();

  const handleRetract = (msgId: number) => {
    del.mutate(
      { id: msgId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetMessageThreadQueryKey({ recipientId: peer.peerId }),
          });
          queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey() });
          toast({ title: "تم سحب الرسالة" });
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "تعذّر السحب",
            description: err?.error ?? "ربما قُرئت الرسالة بالفعل",
          });
        },
      },
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const failedTempIds = new Set(
    pendingMessages.filter((p) => p.status === "failed").map((p) => p.tempId),
  );

  const grouped = groupByDay(allMessages);

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background max-w-[428px] mx-auto animate-in slide-in-from-right-4 duration-250">
      {/* Header */}
      <div className="shrink-0 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors shrink-0"
          aria-label="رجوع"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-base flex items-center justify-center shrink-0">
          {peer.peerName.trim()[0]?.toUpperCase() ?? "؟"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground truncate">{peer.peerName}</p>
          <p className="text-xs text-muted-foreground font-mono" dir="ltr">
            {peer.peerPocketNumber}
          </p>
          {peerProfile && (
            <p className="text-xs text-muted-foreground mt-0.5">
              <PeerPresence
                isOnline={peerProfile.isOnline}
                lastSeenAt={peerProfile.lastSeenAt}
              />
            </p>
          )}
        </div>
        <button
          onClick={() => startCall(peer)}
          className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 hover:bg-primary/20 active:scale-95 transition-all"
          aria-label="بدء مكالمة"
        >
          <Phone className="w-4 h-4" />
        </button>
      </div>

      {/* Messages list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
        onScroll={handleScroll}
      >
        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center pb-2">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs text-primary font-semibold px-4 py-2 rounded-full bg-primary/8 hover:bg-primary/15 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {loadingMore ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              تحميل رسائل أقدم
            </button>
          </div>
        )}

        {threadLoading && allMessages.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : allMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">لا توجد رسائل بعد</p>
            <p className="text-xs text-muted-foreground/70 mt-1">ابدأ المحادثة بإرسال رسالة</p>
          </div>
        ) : (
          grouped.map((group, gi) => (
            <div key={gi}>
              <DayDivider label={group.day} />
              <div className="space-y-1.5">
                {group.msgs.map((msg) => {
                  const isMine = msg.senderId === myId;
                  const isFailed = failedTempIds.has(msg.id);
                  const isPending = msg.id < 0 && !isFailed;
                  // Long-press is available on own messages that are still retractable
                  const canLongPress =
                    isMine && !isPending && !isFailed && !msg.deletedAt && msg.status !== "read";
                  return (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      isMine={isMine}
                      isPending={isPending}
                      isFailed={isFailed}
                      onLongPress={canLongPress ? () => setActionSheetMsgId(msg.id) : undefined}
                      onRetry={isFailed ? () => handleRetry(msg.id) : undefined}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-24 right-4 w-9 h-9 rounded-full bg-primary/90 text-primary-foreground shadow-lg flex items-center justify-center animate-in fade-in duration-150 hover:bg-primary transition-colors"
          aria-label="التمرير للأسفل"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Compose bar */}
      <div className="shrink-0 border-t border-border bg-background px-3 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="اكتب رسالة…"
            rows={1}
            className="flex-1 resize-none bg-muted/50 rounded-2xl px-4 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[42px] max-h-[120px] overflow-y-auto"
            style={{ height: "42px" }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="إرسال"
          >
            <Send className="w-4 h-4" style={{ transform: "scaleX(-1)" }} />
          </button>
        </div>
        <div className="h-safe-bottom" />
      </div>

      {/* Message action sheet */}
      <MessageActionSheet
        open={actionSheetMsgId !== null}
        onRetract={() => {
          if (actionSheetMsgId !== null) handleRetract(actionSheetMsgId);
        }}
        onClose={() => setActionSheetMsgId(null)}
      />
    </div>
  );
}
