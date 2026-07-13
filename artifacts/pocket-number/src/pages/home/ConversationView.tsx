import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMessageThread,
  useSendMessage,
  useDeleteMessage,
  useUpdateMessageStatus,
  getGetInboxQueryKey,
  getGetMessageThreadQueryKey,
  getMessageThread,
} from "@workspace/api-client-react";
import type { MessageItem } from "@workspace/api-client-react";
import type { ChatTarget } from "@/contexts/ChatLauncherContext";
import { ChevronRight, Send, Loader2, Trash2, CheckCheck, Clock, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Status ticks ─────────────────────────────────────────────────────────────

function StatusTick({ status }: { status: MessageItem["status"] }) {
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
  onRetract,
}: {
  msg: MessageItem;
  isMine: boolean;
  onRetract?: () => void;
}) {
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
        "flex items-end gap-1.5 group",
        isMine ? "justify-start" : "justify-end",
      )}
    >
      {/* Retract button for own messages that aren't read yet */}
      {isMine && onRetract && msg.status !== "read" && (
        <button
          onClick={onRetract}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mb-1"
          aria-label="سحب الرسالة"
        >
          <Trash2 className="w-3 h-3 text-muted-foreground" />
        </button>
      )}

      <div
        className={cn(
          "max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words",
          isMine
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
          <span
            className={cn(
              "text-[10px] leading-none",
              isMine ? "text-primary-foreground/60" : "text-muted-foreground",
            )}
          >
            {formatTime(msg.createdAt)}
          </span>
          {isMine && <StatusTick status={msg.status} />}
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [olderMessages, setOlderMessages] = useState<MessageItem[]>([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const markedReadIds = useRef(new Set<number>());

  const myId = user?.id ?? 0;

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

  const liveMessages = threadData?.messages ?? [];

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

  // Merge older (paginated) + live, dedup by id, sort by createdAt ascending
  const allMessages = useCallback(() => {
    const map = new Map<number, MessageItem>();
    for (const m of olderMessages) map.set(m.id, m);
    for (const m of liveMessages) map.set(m.id, m);
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [olderMessages, liveMessages])();

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

  const handleSend = () => {
    const content = text.trim();
    if (!content || send.isPending) return;
    setText("");
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    send.mutate(
      { data: { recipientId: peer.peerId, content } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetMessageThreadQueryKey({ recipientId: peer.peerId }),
          });
          queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey() });
          scrollToBottom(true);
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "تعذّر الإرسال",
            description: err?.error ?? "حدث خطأ غير متوقع",
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
        </div>
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
                {group.msgs.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isMine={msg.senderId === myId}
                    onRetract={msg.senderId === myId ? () => handleRetract(msg.id) : undefined}
                  />
                ))}
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
            disabled={!text.trim() || send.isPending}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="إرسال"
          >
            {send.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" style={{ transform: "scaleX(-1)" }} />
            )}
          </button>
        </div>
        <div className="h-safe-bottom" />
      </div>
    </div>
  );
}
