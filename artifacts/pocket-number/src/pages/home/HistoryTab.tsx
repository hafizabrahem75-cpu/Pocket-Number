import { Clock, PhoneIncoming, PhoneOutgoing, PhoneMissed, Loader2 } from "lucide-react";
import { useGetCallHistory, useGetContacts, useGetUserById } from "@workspace/api-client-react";
import type { CallItem } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCallDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" });
  if (isToday) return time;
  if (isYesterday) return `أمس، ${time}`;
  return `${d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}، ${time}`;
}

function formatDuration(startIso: string, endIso: string) {
  const seconds = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type CallKind = "incoming" | "outgoing" | "missed";

function getCallKind(call: CallItem, myId: number): CallKind {
  if (call.callerId === myId) return "outgoing";
  if (call.status === "missed" || call.status === "declined") return "missed";
  return "incoming";
}

// ── History row ───────────────────────────────────────────────────────────────

function CallHistoryRow({
  call,
  myId,
  contactNameByPocketNumber,
}: {
  call: CallItem;
  myId: number;
  contactNameByPocketNumber: Map<string, string>;
}) {
  const peerId = call.callerId === myId ? call.receiverId : call.callerId;
  const { data: peer, isLoading } = useGetUserById(peerId);
  const kind = getCallKind(call, myId);

  const displayName =
    (peer && contactNameByPocketNumber.get(peer.pocketNumber)) || peer?.name || peer?.pocketNumber;

  const Icon = kind === "outgoing" ? PhoneOutgoing : kind === "missed" ? PhoneMissed : PhoneIncoming;
  const iconColor =
    kind === "missed" ? "text-destructive" : kind === "outgoing" ? "text-primary" : "text-emerald-600";

  return (
    <div className="w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
      <div
        className={cn(
          "w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center shrink-0",
          iconColor,
        )}
      >
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        {isLoading ? (
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        ) : (
          <p
            className={cn(
              "font-semibold text-sm truncate",
              kind === "missed" ? "text-destructive" : "text-foreground",
            )}
          >
            {displayName ?? "مستخدم غير معروف"}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">{formatCallDate(call.startTime)}</p>
      </div>
      {call.endTime && call.status === "ended" && (
        <span className="text-xs text-muted-foreground font-mono shrink-0" dir="ltr">
          {formatDuration(call.startTime, call.endTime)}
        </span>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function HistoryTab() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useGetCallHistory();
  const { data: contacts } = useGetContacts();

  const contactNameByPocketNumber = new Map(
    (contacts ?? []).map((c) => [c.pocketNumber, c.localName] as const),
  );

  const calls = data?.calls ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3.5 border-b border-border bg-background sticky top-0 z-10">
        <h1 className="text-base font-bold text-foreground">السجل</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-muted-foreground text-center py-10">تعذّر تحميل سجل المكالمات</p>
        )}

        {!isLoading && !isError && calls.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-20 px-8 text-center">
            <div className="w-20 h-20 rounded-3xl bg-primary/8 flex items-center justify-center mb-6">
              <Clock className="w-10 h-10 text-primary/60" strokeWidth={1.5} />
            </div>
            <p className="text-lg font-bold text-foreground mb-2">لا توجد مكالمات بعد</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ستظهر مكالماتك الواردة والصادرة هنا
            </p>
          </div>
        )}

        {!isLoading &&
          !isError &&
          user &&
          calls.map((call) => (
            <CallHistoryRow
              key={call.id}
              call={call}
              myId={user.id}
              contactNameByPocketNumber={contactNameByPocketNumber}
            />
          ))}
      </div>
    </div>
  );
}
