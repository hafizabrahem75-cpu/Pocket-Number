import { MobileLayout } from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <MobileLayout>
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-8xl font-black text-primary/20 mb-4">404</div>
        <h1 className="text-2xl font-bold mb-2">الصفحة غير موجودة</h1>
        <p className="text-muted-foreground mb-8">عذراً، لم نتمكن من العثور على الصفحة التي تبحث عنها.</p>
        <Link href="/">
          <Button size="lg" className="px-8">
            العودة للرئيسية
          </Button>
        </Link>
      </div>
    </MobileLayout>
  );
}
