import { useState } from "react";
import { Phone, Delete, Loader2 } from "lucide-react";
import { useCallLauncher } from "@/contexts/CallLauncherContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["+", "0", ""],
];

// ── Main export ───────────────────────────────────────────────────────────────

export default function CallsTab() {
  const [number, setNumber] = useState("");
  const { startCallByPocketNumber, isStarting } = useCallLauncher();
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
            {isStarting ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : (
              <Phone className="w-6 h-6 text-white" />
            )}
          </button>
          <div className="w-11 h-11" />
        </div>
      </div>
    </div>
  );
}
