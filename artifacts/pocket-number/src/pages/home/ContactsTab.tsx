import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useGetContacts,
  useAddContact,
  useUpdateContact,
  useDeleteContact,
  getGetContactsQueryKey,
} from "@workspace/api-client-react";
import type { ContactItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Loader2,
  Users,
  Pencil,
  Trash2,
  X,
  Check,
  Search,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const letter = name.trim()[0]?.toUpperCase() ?? "؟";
  return (
    <div className="w-11 h-11 rounded-full bg-primary/10 text-primary font-bold text-base flex items-center justify-center shrink-0">
      {letter}
    </div>
  );
}

// ── Add Contact Sheet ────────────────────────────────────────────────────────

function AddContactSheet({
  onClose,
}: {
  onClose: () => void;
}) {
  const [pocketNumber, setPocketNumber] = useState("");
  const [localName, setLocalName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const add = useAddContact();

  const handleSubmit = () => {
    const pn = pocketNumber.trim().toUpperCase();
    if (!pn) return;
    add.mutate(
      { data: { pocketNumber: pn, localName: localName.trim() || undefined } },
      {
        onSuccess: () => {
          toast({ title: "تمت الإضافة", description: "جهة الاتصال في قائمتك" });
          queryClient.invalidateQueries({ queryKey: getGetContactsQueryKey() });
          onClose();
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "خطأ", description: err?.error ?? "تعذّرت الإضافة" });
        },
      },
    );
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[428px] bg-background rounded-t-3xl p-6 space-y-5 animate-in slide-in-from-bottom-4 duration-300">
        {/* Handle */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto -mt-1 mb-1" />

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">إضافة جهة اتصال</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              رقم الجيب *
            </label>
            <Input
              placeholder="PN-100001"
              value={pocketNumber}
              onChange={(e) => setPocketNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              dir="ltr"
              className="font-mono text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              الاسم المحلي (اختياري)
            </label>
            <Input
              placeholder="الاسم كما تريد حفظه"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              maxLength={50}
            />
            <p className="text-[11px] text-muted-foreground">
              الاسم خاص بك فقط — لن يراه صاحب الرقم
            </p>
          </div>
        </div>

        <Button
          className="w-full rounded-xl h-12 text-base font-semibold"
          onClick={handleSubmit}
          disabled={add.isPending || !pocketNumber.trim()}
        >
          {add.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin ml-2" />
          ) : (
            <UserPlus className="w-5 h-5 ml-2" />
          )}
          إضافة
        </Button>
      </div>
    </div>
  );
}

// ── Edit Local Name Sheet ────────────────────────────────────────────────────

function EditNameSheet({
  contact,
  onClose,
}: {
  contact: ContactItem;
  onClose: () => void;
}) {
  const [localName, setLocalName] = useState(contact.localName);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const update = useUpdateContact();

  const handleSave = () => {
    const trimmed = localName.trim();
    if (!trimmed || trimmed === contact.localName) { onClose(); return; }
    update.mutate(
      { id: contact.id, data: { localName: trimmed } },
      {
        onSuccess: () => {
          toast({ title: "تم تحديث الاسم" });
          queryClient.invalidateQueries({ queryKey: getGetContactsQueryKey() });
          onClose();
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "خطأ", description: err?.error ?? "تعذّر التحديث" });
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[428px] bg-background rounded-t-3xl p-6 space-y-5 animate-in slide-in-from-bottom-4 duration-300">
        <div className="w-10 h-1 bg-border rounded-full mx-auto -mt-1 mb-1" />

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">تعديل الاسم</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            الاسم المحلي
          </label>
          <Input
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            maxLength={50}
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            className="flex-1 rounded-xl h-11 font-semibold"
            onClick={handleSave}
            disabled={update.isPending || !localName.trim()}
          >
            {update.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Check className="w-4 h-4 ml-1" />}
            حفظ
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Contact Row ──────────────────────────────────────────────────────────────

function ContactRow({
  contact,
  onEdit,
  onDelete,
}: {
  contact: ContactItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border last:border-0">
      {/* Main row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors active:bg-muted/50 text-right"
        onClick={() => setExpanded((v) => !v)}
      >
        <Avatar name={contact.localName} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{contact.localName}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5" dir="ltr">
            {contact.pocketNumber}
          </p>
        </div>
        <ChevronRight
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform shrink-0",
            expanded && "rotate-90",
          )}
        />
      </button>

      {/* Expanded actions */}
      {expanded && (
        <div className="flex gap-2 px-4 pb-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            onClick={() => { setExpanded(false); onEdit(); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/8 hover:bg-primary/15 px-3 py-2 rounded-lg transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            تعديل الاسم
          </button>
          <button
            onClick={() => { setExpanded(false); onDelete(); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-destructive bg-destructive/8 hover:bg-destructive/15 px-3 py-2 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            حذف
          </button>
        </div>
      )}
    </div>
  );
}

// ── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteConfirmDialog({
  contact,
  onClose,
}: {
  contact: ContactItem;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const del = useDeleteContact();

  const handleDelete = () => {
    del.mutate(
      { id: contact.id },
      {
        onSuccess: () => {
          toast({ title: "تم الحذف" });
          queryClient.invalidateQueries({ queryKey: getGetContactsQueryKey() });
          onClose();
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "خطأ", description: err?.error ?? "تعذّر الحذف" });
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[340px] bg-background rounded-3xl p-6 space-y-5 animate-in zoom-in-95 duration-200 shadow-2xl">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <Trash2 className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <p className="font-bold text-base">حذف جهة الاتصال؟</p>
            <p className="text-sm text-muted-foreground mt-1">
              سيتم حذف <span className="font-semibold text-foreground">{contact.localName}</span> من قائمتك نهائياً
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            variant="destructive"
            className="flex-1 rounded-xl h-11 font-semibold"
            onClick={handleDelete}
            disabled={del.isPending}
          >
            {del.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
            حذف
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────────────────────

export default function ContactsTab() {
  const { data: contacts, isLoading } = useGetContacts();
  const [showAdd, setShowAdd] = useState(false);
  const [editContact, setEditContact] = useState<ContactItem | null>(null);
  const [deleteContact, setDeleteContact] = useState<ContactItem | null>(null);
  const [search, setSearch] = useState("");

  // Filter by local name or pocket number
  const filtered = contacts
    ? contacts.filter(
        (c) =>
          c.localName.toLowerCase().includes(search.toLowerCase()) ||
          c.pocketNumber.toLowerCase().includes(search.toLowerCase()),
      )
    : [];

  // Group alphabetically with Arabic-aware collation
  const arCollator = new Intl.Collator("ar", { sensitivity: "base" });

  // Normalise Arabic letter variants so أ/إ/آ all group under ا
  const normaliseInitial = (name: string) =>
    name.trim()[0]?.toUpperCase().replace(/[أإآ]/g, "ا") ?? "#";

  const grouped: Record<string, ContactItem[]> = {};
  for (const c of filtered) {
    const letter = normaliseInitial(c.localName);
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(c);
  }

  // Sort contacts within each section using Arabic-aware ordering
  for (const letter of Object.keys(grouped)) {
    grouped[letter].sort((a, b) => arCollator.compare(a.localName, b.localName));
  }

  const sections = Object.keys(grouped).sort((a, b) => arCollator.compare(a, b));

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-border bg-background sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="بحث في جهات الاتصال…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 text-sm rounded-xl bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        ) : !contacts?.length ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="w-20 h-20 rounded-3xl bg-primary/8 flex items-center justify-center mb-5">
              <Users className="w-10 h-10 text-primary/60" />
            </div>
            <p className="font-bold text-foreground text-base mb-2">لا توجد جهات اتصال</p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px]">
              أضف جهات اتصال برقم الجيب وامنحها أسماء خاصة لا يراها أحد غيرك
            </p>
            <Button
              className="mt-6 rounded-xl px-6 h-11 font-semibold"
              onClick={() => setShowAdd(true)}
            >
              <UserPlus className="w-4 h-4 ml-2" />
              إضافة أول جهة
            </Button>
          </div>
        ) : search && !filtered.length ? (
          /* No search results */
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <p className="font-semibold text-foreground mb-1">لا نتائج</p>
            <p className="text-sm text-muted-foreground">لم يُعثر على "{search}" في جهات الاتصال</p>
          </div>
        ) : (
          /* Grouped list */
          sections.map((letter) => (
            <div key={letter}>
              {/* Section header */}
              <div className="px-4 py-1.5 bg-muted/40 border-b border-border">
                <span className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase">
                  {letter}
                </span>
              </div>
              {grouped[letter].map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  onEdit={() => setEditContact(contact)}
                  onDelete={() => setDeleteContact(contact)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* FAB — Add contact */}
      {!!contacts?.length && (
        <button
          onClick={() => setShowAdd(true)}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 ml-[calc(428px/2-56px)] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all z-20"
          aria-label="إضافة جهة اتصال"
          style={{ marginLeft: "calc(min(428px, 100vw) / 2 - 56px)" }}
        >
          <UserPlus className="w-6 h-6" />
        </button>
      )}

      {/* Sheets & dialogs */}
      {showAdd && <AddContactSheet onClose={() => setShowAdd(false)} />}
      {editContact && (
        <EditNameSheet contact={editContact} onClose={() => setEditContact(null)} />
      )}
      {deleteContact && (
        <DeleteConfirmDialog contact={deleteContact} onClose={() => setDeleteContact(null)} />
      )}
    </div>
  );
}
