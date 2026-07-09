import { useState, useRef } from "react";
import { MobileLayout } from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import {
  useSearchUsers,
  useAddContact,
  getGetContactsQueryKey,
  getSearchUsersQueryKey,
} from "@workspace/api-client-react";
import type { PublicUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatLastSeen } from "@/lib/formatLastSeen";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Search,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  CheckCircle2,
  UserX,
} from "lucide-react";

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ isOnline, lastSeenAt }: { isOnline: boolean; lastSeenAt: string | null }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full",
        isOnline
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          isOnline ? "bg-emerald-500 animate-pulse" : "bg-gray-400",
        )}
      />
      {isOnline ? "متصل الآن" : formatLastSeen(lastSeenAt)}
    </div>
  );
}

// ── Result Card ───────────────────────────────────────────────────────────────

function ResultCard({ user }: { user: PublicUser }) {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addContact = useAddContact();

  const isSelf = me && user.id === me.id;
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addContact.mutate(
      { data: { pocketNumber: user.pocketNumber } },
      {
        onSuccess: () => {
          setAdded(true);
          queryClient.invalidateQueries({ queryKey: getGetContactsQueryKey() });
          queryClient.invalidateQueries({
            queryKey: getSearchUsersQueryKey({ q: user.pocketNumber }),
          });
          toast({ title: "تمت الإضافة", description: `${user.name} في جهات اتصالك` });
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "خطأ",
            description: err?.error ?? "تعذّرت الإضافة",
          });
        },
      },
    );
  };

  return (
    <div className="mx-4 rounded-3xl border border-border bg-background shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-400">
      {/* Avatar strip */}
      <div className="bg-gradient-to-br from-primary/15 to-primary/5 px-6 pt-8 pb-6 flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-primary/15 border-4 border-background shadow-md flex items-center justify-center">
            <span className="text-3xl font-black text-primary">
              {user.name.trim()[0]?.toUpperCase() ?? "؟"}
            </span>
          </div>
          {/* Online dot on avatar */}
          <span
            className={cn(
              "absolute bottom-1 left-1 w-4 h-4 rounded-full border-2 border-background",
              user.isOnline ? "bg-emerald-500" : "bg-gray-400",
            )}
          />
        </div>

        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{user.name}</p>
          <p
            className="text-sm font-mono text-primary font-semibold tracking-wider mt-0.5"
            dir="ltr"
          >
            {user.pocketNumber}
          </p>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-2 justify-center">
          <StatusBadge isOnline={user.isOnline} lastSeenAt={user.lastSeenAt} />
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full",
              user.isVerified
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
            )}
          >
            {user.isVerified ? (
              <ShieldCheck className="w-3.5 h-3.5" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5" />
            )}
            {user.isVerified ? "موثّق" : "غير موثّق"}
          </div>
        </div>
      </div>

      {/* Action */}
      <div className="px-6 py-5">
        {isSelf ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-1">
            <UserX className="w-4 h-4" />
            هذا رقمك الخاص
          </div>
        ) : added ? (
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 py-1">
            <CheckCircle2 className="w-5 h-5" />
            تمت الإضافة إلى جهات الاتصال
          </div>
        ) : (
          <Button
            className="w-full rounded-xl h-12 text-base font-semibold"
            onClick={handleAdd}
            disabled={addContact.isPending}
          >
            {addContact.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin ml-2" />
            ) : (
              <UserPlus className="w-5 h-5 ml-2" />
            )}
            إضافة إلى جهات الاتصال
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    data: result,
    isLoading,
    error,
    isFetching,
  } = useSearchUsers(
    { q: submitted },
    {
      query: {
        enabled: submitted.length > 0,
        queryKey: getSearchUsersQueryKey({ q: submitted }),
        retry: false,
      },
    },
  );

  const handleSearch = () => {
    const trimmed = query.trim().toUpperCase();
    if (!trimmed) return;
    setSubmitted(trimmed);
  };

  const busy = isLoading || isFetching;

  return (
    <MobileLayout>
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-background">
        {/* Header */}
        <header className="px-4 pt-12 pb-4 bg-background border-b border-border sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/home")}
              className="w-9 h-9 rounded-full bg-secondary/60 hover:bg-secondary flex items-center justify-center shrink-0 transition-colors"
              aria-label="رجوع"
            >
              <ArrowRight className="w-4 h-4 text-secondary-foreground" />
            </button>
            <h1 className="text-lg font-bold flex-1">البحث عن مستخدم</h1>
          </div>

          {/* Search input */}
          <div className="flex gap-2 mt-4">
            <Input
              ref={inputRef}
              placeholder="710000001"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              dir="ltr"
              className="flex-1 font-mono text-sm h-11 rounded-xl"
              autoFocus
              autoCapitalize="characters"
            />
            <Button
              onClick={handleSearch}
              size="icon"
              className="h-11 w-11 rounded-xl shrink-0"
              disabled={busy || !query.trim()}
              aria-label="بحث"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 py-6 space-y-4">
          {/* Idle */}
          {!submitted && (
            <div className="flex flex-col items-center justify-center pt-16 px-8 text-center gap-4">
              <div className="w-20 h-20 rounded-3xl bg-primary/8 flex items-center justify-center">
                <Search className="w-10 h-10 text-primary/50" />
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">ابحث برقم الجيب</p>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px]">
                  أدخل الرقم المكون من 9 أرقام مثل{" "}
                  <span className="font-mono font-bold text-foreground" dir="ltr">
                    710000001
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Loading */}
          {submitted && busy && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Not found */}
          {submitted && !busy && error && (
            <div className="mx-4 rounded-3xl border border-dashed border-border bg-background p-8 flex flex-col items-center text-center gap-3 animate-in fade-in duration-300">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <UserX className="w-7 h-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">لم يُعثر على مستخدم</p>
                <p className="text-sm text-muted-foreground mt-1">
                  لا يوجد حساب برقم{" "}
                  <span className="font-mono font-bold" dir="ltr">
                    {submitted}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Result */}
          {submitted && !busy && result && <ResultCard key={submitted} user={result} />}
        </div>
      </div>
    </MobileLayout>
  );
}
