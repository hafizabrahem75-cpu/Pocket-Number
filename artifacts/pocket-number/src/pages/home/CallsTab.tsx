import { useState } from "react";
import { Phone, Delete } from "lucide-react";
import { useCallLauncher } from "@/contexts/CallLauncherContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", ""],
];

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

      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8 pb-10">
        {/* Number display */}
        <div className="w-full min-h-[2.5rem] flex items-center justify-center">
          <span
            className="text-2xl font-mono font-bold text-foreground tracking-widest break-all text-center"
            dir="ltr"
          >
            {number || <span className="text-muted-foreground/40">أدخل رقم الجيب</span>}
          </span>
        </div>

        {/* Dial pad */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
          {KEYS.flat().map((key, i) =>
            key ? (
              <button
                key={i}
                onClick={() => handleKey(key)}
                className="aspect-square rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-2xl font-bold text-foreground active:scale-95 transition-transform"
              >
                {key}
              </button>
            ) : (
              <div key={i} />
            ),
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-6 mt-2">
          <button
            onClick={handleBackspace}
            disabled={!number}
            aria-label="حذف"
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
              number ? "text-muted-foreground hover:bg-muted/60" : "text-muted-foreground/30",
            )}
          >
            <Delete className="w-5 h-5" />
          </button>
          <button
            onClick={handleCall}
            disabled={!number.trim() || isStarting}
            aria-label="اتصال"
            className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <Phone className="w-7 h-7 text-white" />
          </button>
          <div className="w-12 h-12" />
        </div>
      </div>
    </div>
  );
}
