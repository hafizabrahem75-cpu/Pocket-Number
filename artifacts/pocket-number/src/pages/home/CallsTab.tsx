import { useState } from "react";
import { Phone, Delete, PhoneIncoming, PhoneOutgoing, PhoneMissed, Loader2 } from "lucide-react";
import {
  useGetCallHistory,
  useGetContacts,
  useGetUserById,
} from "@workspace/api-client-react";
import type { CallItem } from "@workspace/api-client-react";
import { useCallLauncher } from "@/contexts/CallLauncherContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", ""],
];

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

// ── History list ──────────────────────────────────────────────────────────────

function CallHistoryList({ myId }: { myId: number }) {
  const { data, isLoading, isError } = useGetCallHistory();
  const { data: contacts } = useGetContacts();

  const contactNameByPocketNumber = new Map(
    (contacts ?? []).map((c) => [c.pocketNumber, c.localName] as const),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-muted-foreground text-center py-10">تعذّر تحميل سجل المكالمات</p>
    );
  }

  const calls = data?.calls ?? [];

  if (calls.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-10">لا توجد مكالمات بعد</p>
    );
  }

  return (
    <div>
      {calls.map((call) => (
        <CallHistoryRow
          key={call.id}
          call={call}
          myId={myId}
          contactNameByPocketNumber={contactNameByPocketNumber}
        />
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CallsTab() {
  const [number, setNumber] = useState("");
  const { startCallByPocketNumber, isStarting } = useCallLauncher();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleKey = (key: string) => {
    if (!key) return;
    setNumber((v) => (v.length < 20 ? v + key : v));
  };

  const handleBackspace = () => setNumber((v) => v.slice(0, -1));

  const handleCall = async () => {
    const trimmed = number.trim().toUpperCase();
    if (!trimmed) return;
    try {
      await startCallByPocketNumber(trimmed);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "تعذّر بدء الاتصال",
        description: err?.data?.error ?? "لم يُعثر على هذا الرقم",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3.5 border-b border-border bg-background sticky top-0 z-10">
        <h1 className="text-base font-bold text-foreground">المكالمات</h1>
      </div>

      {/* Dial pad */}
      <div className="flex flex-col items-center gap-5 px-8 py-6 border-b border-border">
        <div className="w-full min-h-[2rem] flex items-center justify-center">
          <span
            className="text-xl font-mono font-bold text-foreground tracking-widest break-all text-center"
            dir="ltr"
          >
            {number || <span className="text-muted-foreground/40 text-base">أدخل رقم الجيب</span>}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
          {KEYS.flat().map((key, i) =>
            key ? (
              <button
                key={i}
                onClick={() => handleKey(key)}
                className="aspect-square rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-xl font-bold text-foreground active:scale-95 transition-transform"
              >
                {key}
              </button>
            ) : (
              <div key={i} />
            ),
          )}
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={handleBackspace}
            disabled={!number}
            aria-label="حذف"
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center transition-colors",
              number ? "text-muted-foreground hover:bg-muted/60" : "text-muted-foreground/30",
            )}
          >
            <Delete className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={handleCall}
            disabled={!number.trim() || isStarting}
            aria-label="اتصال"
            className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <Phone className="w-6 h-6 text-white" />
          </button>
          <div className="w-11 h-11" />
        </div>
      </div>

      {/* Call history */}
      <div className="flex-1 overflow-y-auto">
        <p className="px-4 pt-3 pb-1 text-xs font-bold text-muted-foreground">سجل المكالمات</p>
        {user && <CallHistoryList myId={user.id} />}
      </div>
    </div>
  );
}
