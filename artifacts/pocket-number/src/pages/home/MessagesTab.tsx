import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useGetInbox,
  getGetInboxQueryKey,
  useGetContacts,
  searchUsers,
} from "@workspace/api-client-react";
import type { ConversationListItem, ContactItem } from "@workspace/api-client-react";
import { MessageCircle, Loader2, SquarePen, X, Search, UserX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ConversationView from "./ConversationView";
import type { ChatTarget } from "@/contexts/ChatLauncherContext";

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
  displayName,
  isKnown,
  onOpen,
}: {
  conv: ConversationListItem;
  displayName: string;
  isKnown: boolean;
  onOpen: () => void;
}) {
  const { unreadCount, lastMessage } = conv;
  const hasUnread = unreadCount > 0;

  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 active:bg-muted/50 transition-colors text-right border-b border-border last:border-0"
    >
      <Avatar name={isKnown ? displayName : "؟"} unread={unreadCount} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("font-semibold text-sm truncate", hasUnread ? "text-foreground" : "text-foreground/80")}>
            {isKnown ? displayName : "مستخدم غير معروف"}
          </p>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {formatRelativeTime(lastMessage.createdAt)}
          </span>
        </div>
        {!isKnown && (
          <p className="text-[10px] font-mono text-muted-foreground/60 leading-none mb-0.5" dir="ltr">
            {displayName}
          </p>
        )}
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

// ── New Message sheet ────────────────────────────────────────────────────────

function NewMessageSheet({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (target: ChatTarget) => void;
}) {
  const { data: contacts, isLoading } = useGetContacts();
  const [search, setSearch] = useState("");
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Only show contacts that are registered on Pocket Number (isLinked = true).
  // Unregistered contacts cannot receive messages, so they are excluded entirely.
  const linkedContacts = (contacts ?? []).filter((c) => c.isLinked);
  const filtered = linkedContacts.filter(
    (c) =>
      c.localName.toLowerCase().includes(search.toLowerCase()) ||
      c.pocketNumber.toLowerCase().includes(search.toLowerCase()),
  );

  const handlePick = async (contact: ContactItem) => {
    setResolvingId(contact.id);
    try {
      const peer = await searchUsers({ q: contact.pocketNumber });
      onSelect({ peerId: peer.id, peerName: contact.localName, peerPocketNumber: peer.pocketNumber });
    } catch {
      toast({
        variant: "destructive",
        title: "تعذّر بدء المحادثة",
        description: "لم يُعثر على هذا المستخدم",
      });
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[428px] h-[80vh] bg-background rounded-t-3xl flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-1 shrink-0" />

        <div className="flex items-center justify-between px-6 py-3 shrink-0">
          <h2 className="text-lg font-bold">رسالة جديدة</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-3 shrink-0">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="بحث في جهات الاتصال…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9 text-sm rounded-xl bg-muted/50 border-0 focus-visible:ring-1"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-2">
              <UserX className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {!contacts?.length
                  ? "لا توجد جهات اتصال بعد"
                  : !linkedContacts.length
                    ? "لا توجد جهات اتصال مسجّلة على التطبيق بعد"
                    : "لا نتائج"}
              </p>
            </div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => handlePick(c)}
                disabled={resolvingId === c.id}
                className="w-full flex items-center gap-3 px-6 py-3 hover:bg-muted/30 active:bg-muted/50 transition-colors text-right disabled:opacity-60"
              >
                <div className="w-11 h-11 rounded-full bg-primary/10 text-primary font-bold text-base flex items-center justify-center shrink-0">
                  {c.localName.trim()[0]?.toUpperCase() ?? "؟"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{c.localName}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5" dir="ltr">
                    {c.pocketNumber}
                  </p>
                </div>
                {resolvingId === c.id && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        <button
          onClick={() => {
            onClose();
            setLocation("/search");
          }}
          className="shrink-0 m-4 text-sm font-semibold text-primary bg-primary/8 hover:bg-primary/15 rounded-xl py-3 transition-colors"
        >
          البحث عن رقم جديد
        </button>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function MessagesTab({
  initialPeer,
  onInitialPeerConsumed,
}: {
  /** A target to open a conversation with immediately (e.g. from contacts/search), even if no messages exist yet. */
  initialPeer?: ChatTarget | null;
  onInitialPeerConsumed?: () => void;
} = {}) {
  const [openConv, setOpenConv] = useState<ChatTarget | null>(null);
  const [showNewMessage, setShowNewMessage] = useState(false);

  const { data, isLoading } = useGetInbox({
    query: { queryKey: getGetInboxQueryKey(), refetchInterval: 5_000, staleTime: 0 },
  });
  const { data: contacts } = useGetContacts();

  const conversations = data?.conversations ?? [];

  // Build pocket-number → local name map for V1 identity rule:
  // show local contact name if saved, otherwise show pocket number only.
  const contactNameByPN = new Map(
    (contacts ?? []).map((c) => [c.pocketNumber, c.localName]),
  );

  // Open a conversation requested from another page (contacts/search),
  // even when no prior messages exist between the two users.
  useEffect(() => {
    if (initialPeer) {
      setOpenConv(initialPeer);
      onInitialPeerConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPeer]);

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-border bg-background sticky top-0 z-10 flex items-center justify-between">
          <h1 className="text-base font-bold text-foreground">الرسائل</h1>
          <button
            onClick={() => setShowNewMessage(true)}
            className="w-9 h-9 rounded-full bg-secondary/60 hover:bg-secondary flex items-center justify-center transition-colors"
            aria-label="رسالة جديدة"
          >
            <SquarePen className="w-4 h-4 text-secondary-foreground" />
          </button>
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
              {conversations.map((conv) => {
                const contactName = contactNameByPN.get(conv.peerPocketNumber);
                const isKnown = contactName !== undefined;
                const displayName = contactName ?? conv.peerPocketNumber;
                return (
                <ConversationRow
                  key={conv.peerId}
                  conv={conv}
                  displayName={displayName}
                  isKnown={isKnown}
                  onOpen={() =>
                    setOpenConv({
                      peerId: conv.peerId,
                      peerName: displayName,
                      peerPocketNumber: conv.peerPocketNumber,
                    })
                  }
                />
              );
              })}
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

      {/* New message sheet */}
      {showNewMessage && (
        <NewMessageSheet
          onClose={() => setShowNewMessage(false)}
          onSelect={(target) => {
            setShowNewMessage(false);
            setOpenConv(target);
          }}
        />
      )}
    </>
  );
}
