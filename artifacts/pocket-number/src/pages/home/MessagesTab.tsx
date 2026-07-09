import { useState } from "react";
import { useGetInbox, getGetInboxQueryKey } from "@workspace/api-client-react";
import type { ConversationListItem } from "@workspace/api-client-react";
import { MessageCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ConversationView from "./ConversationView";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "الآن";
  if (min < 60) return `${min} د`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} س`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} ي`;
  return new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "numeric" });
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, unread }: { name: string; unread: number }) {
  const letter = name.trim()[0]?.toUpperCase() ?? "؟";
  return (
    <div className="relative shrink-0">
      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-base flex items-center justify-center">
        {letter}
      </div>
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1 leading-none">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </div>
  );
}

// ── Conversation row ──────────────────────────────────────────────────────────

function ConversationRow({
  conv,
  onOpen,
}: {
  conv: ConversationListItem;
  onOpen: () => void;
}) {
  const { peerName, peerPocketNumber, unreadCount, lastMessage } = conv;
  const hasUnread = unreadCount > 0;

  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 active:bg-muted/50 transition-colors text-right border-b border-border last:border-0"
    >
      <Avatar name={peerName} unread={unreadCount} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("font-semibold text-sm truncate", hasUnread ? "text-foreground" : "text-foreground/80")}>
            {peerName}
          </p>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {formatRelativeTime(lastMessage.createdAt)}
          </span>
        </div>
        <p
          className={cn(
            "text-xs mt-0.5 truncate leading-relaxed",
            hasUnread ? "text-foreground/80 font-medium" : "text-muted-foreground",
          )}
        >
          {lastMessage.senderId !== conv.peerId && (
            <span className="text-muted-foreground font-normal ml-1">أنت:</span>
          )}
          {lastMessage.content}
        </p>
      </div>
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function MessagesTab() {
  const [openConv, setOpenConv] = useState<ConversationListItem | null>(null);

  const { data, isLoading } = useGetInbox({
    query: { queryKey: getGetInboxQueryKey(), refetchInterval: 5_000, staleTime: 0 },
  });

  const conversations = data?.conversations ?? [];

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-border bg-background sticky top-0 z-10">
          <h1 className="text-base font-bold text-foreground">الرسائل</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center h-full">
              <div className="w-20 h-20 rounded-3xl bg-primary/8 flex items-center justify-center mb-6">
                <MessageCircle className="w-10 h-10 text-primary/60" strokeWidth={1.5} />
              </div>
              <p className="text-base font-bold text-foreground mb-2">لا توجد محادثات</p>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[240px]">
                ابحث عن شخص برقم جيبه وأرسل له رسالة للبدء
              </p>
            </div>
          ) : (
            <div>
              {conversations.map((conv) => (
                <ConversationRow
                  key={conv.peerId}
                  conv={conv}
                  onOpen={() => setOpenConv(conv)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Conversation overlay */}
      {openConv && (
        <ConversationView
          peer={openConv}
          onBack={() => {
            setOpenConv(null);
          }}
        />
      )}
    </>
  );
}
