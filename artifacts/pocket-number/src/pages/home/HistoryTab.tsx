import { Clock } from "lucide-react";

export default function HistoryTab() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 px-8 text-center">
      <div className="w-20 h-20 rounded-3xl bg-primary/8 flex items-center justify-center mb-6">
        <Clock className="w-10 h-10 text-primary/60" strokeWidth={1.5} />
      </div>
      <p className="text-lg font-bold text-foreground mb-2">سجل المكالمات</p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        سجل المكالمات سيظهر هنا في المرحلة التالية
      </p>
    </div>
  );
}
