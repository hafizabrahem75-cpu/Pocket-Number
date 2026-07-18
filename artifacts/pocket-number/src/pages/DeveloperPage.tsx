/**
 * DeveloperPage — "عن المطور"
 *
 * Single source of truth for all developer contact information.
 * To update any contact detail, edit DEVELOPER below and nothing else needs changing.
 * To add Telegram, uncomment the telegram entry and supply the username.
 */

import { MobileLayout } from "@/components/MobileLayout";
import { Link } from "wouter";
import { ArrowRight, Phone, MessageCircle, MessageSquareText, Mail, Send } from "lucide-react";
import { useAppSettings } from "@/contexts/AppSettingsContext";

// ── Contact constants — edit here only ───────────────────────────────────────

export const DEVELOPER = {
  name: "أ. حافظ السراء",
  phone: "+967717245252",
  email: "hafiz.abrahem75@gmail.com",
  // telegram: "username_here",   ← uncomment and fill in when available
} as const;

// ── Derived link targets (not editable — computed from above) ─────────────────

const waNumber = DEVELOPER.phone.replace(/[^\d]/g, "");

// ── Copy ──────────────────────────────────────────────────────────────────────

const copy = {
  ar: {
    back: "الإعدادات",
    title: "عن المطور",
    description: "مطوّر تطبيقات الجوال ومصمم واجهات المستخدم.",
    contactSection: "التواصل",
    call: "اتصال هاتفي",
    whatsapp: "واتساب",
    sms: "رسالة نصية",
    email: "بريد إلكتروني",
    telegram: "تيليغرام",
  },
  en: {
    back: "Settings",
    title: "About Developer",
    description: "Mobile app developer and UI/UX designer.",
    contactSection: "Contact",
    call: "Phone Call",
    whatsapp: "WhatsApp",
    sms: "SMS",
    email: "Email",
    telegram: "Telegram",
  },
} as const;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DeveloperPage() {
  const { language } = useAppSettings();
  const t = copy[language];

  const initial = DEVELOPER.name.trim()[0] ?? "؟";

  const actions: { label: string; icon: typeof Phone; href: string }[] = [
    { label: t.call,      icon: Phone,              href: `tel:${DEVELOPER.phone}` },
    { label: t.whatsapp,  icon: MessageCircle,      href: `https://wa.me/${waNumber}` },
    { label: t.sms,       icon: MessageSquareText,  href: `sms:${DEVELOPER.phone}` },
    { label: t.email,     icon: Mail,               href: `mailto:${DEVELOPER.email}` },
    // Telegram — uncomment when username is available:
    // ...(DEVELOPER.telegram
    //   ? [{ label: t.telegram, icon: Send, href: `https://t.me/${DEVELOPER.telegram}` }]
    //   : []),
  ];

  return (
    <MobileLayout>
      {/* Header */}
      <header className="px-6 pt-12 pb-4 bg-background border-b sticky top-0 z-10 flex items-center shadow-sm shrink-0">
        <Link href="/settings" className="ml-4 text-muted-foreground hover:text-foreground">
          <ArrowRight className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold flex-1">{t.title}</h1>
      </header>

      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-background">
        <div className="px-5 py-8 space-y-8 max-w-md mx-auto">

          {/* Developer card */}
          <div className="bg-background rounded-2xl border shadow-sm overflow-hidden">
            <div className="flex flex-col items-center py-8 px-6 gap-3">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-3xl font-black text-primary">{initial}</span>
              </div>

              {/* Name */}
              <div className="text-center">
                <p className="text-xl font-black text-foreground leading-tight" dir="rtl">
                  {DEVELOPER.name}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
              </div>
            </div>

            {/* Contact details strip */}
            <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              <div className="px-5 py-3 flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-mono text-foreground tracking-wide" dir="ltr">
                  {DEVELOPER.phone}
                </span>
              </div>
              <div className="px-5 py-3 flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground break-all" dir="ltr">
                  {DEVELOPER.email}
                </span>
              </div>
            </div>
          </div>

          {/* Contact actions */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              {t.contactSection}
            </p>
            <div className="bg-background rounded-2xl border shadow-sm overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
              {actions.map(({ label, icon: Icon, href }) => (
                <a
                  key={label}
                  href={href}
                  className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 active:bg-muted/40 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-sm">{label}</span>
                </a>
              ))}
            </div>
          </div>

        </div>
      </div>
    </MobileLayout>
  );
}
