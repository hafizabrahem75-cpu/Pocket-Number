import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useSearchUsers,
  useGetFriends,
  useGetIncomingFriendRequests,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useRejectFriendRequest,
  useCancelFriendRequest,
  getSearchUsersQueryKey,
  getGetFriendsQueryKey,
  getGetIncomingFriendRequestsQueryKey,
  getGetOutgoingFriendRequestsQueryKey,
} from "@workspace/api-client-react";
import type { FriendRequestItem, FriendEntry, PublicUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search,
  UserPlus,
  UserCheck,
  UserX,
  Loader2,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const letter = name.trim()[0]?.toUpperCase() ?? "؟";
  const sizeClasses = {
    sm: "w-9 h-9 text-sm",
    md: "w-11 h-11 text-base",
    lg: "w-14 h-14 text-xl",
  };
  return (
    <div
      className={cn(
        "rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0",
        sizeClasses[size],
      )}
    >
      {letter}
    </div>
  );
}

// ── Search section ──────────────────────────────────────────────────────────

function SearchSection() {
  const { user: me } = useAuth();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: result,
    isLoading,
    error,
  } = useSearchUsers(
    { q: submittedQuery },
    {
      query: {
        enabled: submittedQuery.length > 0,
        queryKey: getSearchUsersQueryKey({ q: submittedQuery }),
      },
    },
  );

  const sendRequest = useSendFriendRequest();
  const cancelRequest = useCancelFriendRequest();

  const handleSearch = () => {
    const trimmed = query.trim().toUpperCase();
    if (!trimmed) return;
    setSubmittedQuery(trimmed);
  };

  const handleSendRequest = (user: PublicUser) => {
    sendRequest.mutate(
      { data: { addresseeId: user.id } },
      {
        onSuccess: () => {
          toast({ title: "تم إرسال طلب الصداقة" });
          queryClient.invalidateQueries({ queryKey: getGetOutgoingFriendRequestsQueryKey() });
          setSubmittedQuery((q) => q); // re-trigger search refetch
          queryClient.invalidateQueries({ queryKey: ["searchUsers", submittedQuery] });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "خطأ", description: err.error ?? "تعذّر إرسال الطلب" });
        },
      },
    );
  };

  const handleCancel = (friendshipId: number) => {
    cancelRequest.mutate(
      { id: friendshipId },
      {
        onSuccess: () => {
          toast({ title: "تم إلغاء الطلب" });
          queryClient.invalidateQueries({ queryKey: getGetOutgoingFriendRequestsQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["searchUsers", submittedQuery] });
        },
      },
    );
  };

  const isSelf = result && me && result.id === me.id;

  return (
    <div className="p-4 border-b border-border space-y-3">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">البحث برقم الجيب</p>
      <div className="flex gap-2">
        <Input
          placeholder="PN-100001"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          dir="ltr"
          className="flex-1 font-mono text-sm"
        />
        <Button onClick={handleSearch} size="icon" disabled={isLoading || !query.trim()} className="shrink-0">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {/* Search result */}
      {submittedQuery && !isLoading && (
        <>
          {error ? (
            <div className="rounded-xl border border-dashed border-border p-3 text-center">
              <p className="text-sm text-muted-foreground">لم يُعثر على مستخدم برقم <span dir="ltr" className="font-mono font-bold">{submittedQuery}</span></p>
            </div>
          ) : result && !isSelf ? (
            <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-3">
              <Avatar name={result.name} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{result.name}</p>
                <p className="text-xs text-muted-foreground font-mono" dir="ltr">{result.pocketNumber}</p>
              </div>
              {result.friendshipStatus === "none" && (
                <Button
                  size="sm"
                  onClick={() => handleSendRequest(result)}
                  disabled={sendRequest.isPending}
                  className="shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5 ml-1" />
                  إضافة
                </Button>
              )}
              {result.friendshipStatus === "pending_sent" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => result.friendshipId && handleCancel(result.friendshipId)}
                  disabled={cancelRequest.isPending}
                  className="shrink-0 text-muted-foreground"
                >
                  <Clock className="w-3.5 h-3.5 ml-1" />
                  قيد الانتظار
                </Button>
              )}
              {result.friendshipStatus === "pending_received" && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium shrink-0">
                  أرسل لك طلب
                </span>
              )}
              {result.friendshipStatus === "accepted" && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium shrink-0">
                  <UserCheck className="w-3.5 h-3.5" />
                  صديق
                </span>
              )}
            </div>
          ) : isSelf ? (
            <div className="rounded-xl border border-dashed border-border p-3 text-center">
              <p className="text-sm text-muted-foreground">هذا رقمك الخاص!</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// ── Incoming requests section ───────────────────────────────────────────────

function IncomingRequestsSection() {
  const { data: requests, isLoading } = useGetIncomingFriendRequests();
  const [expanded, setExpanded] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const accept = useAcceptFriendRequest();
  const reject = useRejectFriendRequest();

  const handleAccept = (req: FriendRequestItem) => {
    accept.mutate(
      { id: req.id },
      {
        onSuccess: () => {
          toast({ title: "تمت إضافة الصديق", description: req.requester.name });
          queryClient.invalidateQueries({ queryKey: getGetIncomingFriendRequestsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetFriendsQueryKey() });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "خطأ", description: err.error ?? "فشلت العملية" });
        },
      },
    );
  };

  const handleReject = (req: FriendRequestItem) => {
    reject.mutate(
      { id: req.id },
      {
        onSuccess: () => {
          toast({ title: "تم رفض الطلب" });
          queryClient.invalidateQueries({ queryKey: getGetIncomingFriendRequestsQueryKey() });
        },
      },
    );
  };

  if (isLoading || !requests?.length) return null;

  return (
    <div className="border-b border-border">
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">طلبات الصداقة</span>
          <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
            {requests.length}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {requests.map((req) => (
            <div key={req.id} className="rounded-xl border border-border bg-muted/20 p-3 flex items-center gap-3">
              <Avatar name={req.requester.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{req.requester.name}</p>
                <p className="text-xs text-muted-foreground font-mono" dir="ltr">{req.requester.pocketNumber}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => handleAccept(req)}
                  disabled={accept.isPending}
                  className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors disabled:opacity-50"
                  aria-label="قبول"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleReject(req)}
                  disabled={reject.isPending}
                  className="w-8 h-8 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-600 flex items-center justify-center transition-colors disabled:opacity-50"
                  aria-label="رفض"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Friends list ────────────────────────────────────────────────────────────

function FriendsList() {
  const { data: friends, isLoading } = useGetFriends();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!friends?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="font-semibold text-foreground mb-1">لا يوجد أصدقاء بعد</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          ابحث عن أصدقائك برقم الجيب الخاص بهم وأضفهم
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-3 pb-4 space-y-2">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">
        الأصدقاء · {friends.length}
      </p>
      {friends.map((friend: FriendEntry) => (
        <div key={friend.friendshipId} className="rounded-xl border border-border bg-background p-3 flex items-center gap-3">
          <Avatar name={friend.user.name} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{friend.user.name}</p>
            <p className="text-xs text-muted-foreground font-mono" dir="ltr">{friend.user.pocketNumber}</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="صديق" />
        </div>
      ))}
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────────────────────

export default function ContactsTab() {
  return (
    <div className="flex flex-col h-full">
      <SearchSection />
      <IncomingRequestsSection />
      <div className="flex-1 overflow-y-auto">
        <FriendsList />
      </div>
    </div>
  );
}
