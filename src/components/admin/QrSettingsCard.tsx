"use client";

import { useEffect, useMemo, useState } from "react";
import { QrCode, UploadSimple, CaretDown, CaretUp, CheckCircle, Warning } from "@phosphor-icons/react";
import { Card } from "@/components/admin/ui";
import { useToast } from "@/context/ToastContext";
import { api, errorMessage } from "@/lib/api";
import { fieldErrors, inputClass } from "@/lib/teach";
import type { AdminQrSettings } from "@/lib/admin";

const MAX_MB = 5;

/** Lop-rig's bank QR code and account details that students pay to. */
export default function QrSettingsCard() {
  const { push } = useToast();
  const [settings, setSettings] = useState<AdminQrSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ account_name: "", bank_name: "", account_number: "", instructions: "", alert_email: "" });
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const preview = useMemo(() => (image ? URL.createObjectURL(image) : ""), [image]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    api<AdminQrSettings>("/manage/payment-settings/")
      .then((s) => {
        setSettings(s);
        setForm({
          account_name: s.account_name, bank_name: s.bank_name, account_number: s.account_number,
          instructions: s.instructions, alert_email: s.alert_email,
        });
        setOpen(!s.ready); // nothing set up yet: open it straight away
      })
      .catch((err) => push(errorMessage(err), "error"));
  }, [push]);

  if (!settings) return null;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const pick = (file?: File) => {
    setErrors((e) => ({ ...e, qr_image: "" }));
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return setErrors((e) => ({ ...e, qr_image: "Use a PNG, JPG or WebP image." }));
    if (file.size > MAX_MB * 1024 * 1024) return setErrors((e) => ({ ...e, qr_image: `The limit is ${MAX_MB} MB.` }));
    setImage(file);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.account_name.trim()) return setErrors({ account_name: "Enter the account holder's name." });
    if (!settings.qr_image_url && !image) return setErrors({ qr_image: "Upload the QR code image." });
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, v.trim()));
    if (image) body.append("qr_image", image);
    setSaving(true);
    setErrors({});
    try {
      const next = await api<AdminQrSettings>("/manage/payment-settings/", { method: "PATCH", body });
      setSettings(next);
      setImage(null);
      push("Payment QR saved. Students now see it on the enroll page.", "success");
    } catch (err) {
      setErrors(fieldErrors(err));
      push(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const shown = preview || settings.qr_image_url;
  return (
    <Card
      title="Payment QR code"
      description={settings.ready ? `Students pay ${settings.account_name} by scanning this code.` : "Add Lop-rig's bank QR so students can pay for courses."}
      action={
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn btn-sm btn-outline-neutral inline-flex items-center gap-1">
          {open ? <>Close <CaretUp size={13} /></> : <>{settings.ready ? "Change" : "Set up"} <CaretDown size={13} /></>}
        </button>
      }
    >
      {!open ? (
        <p className={`inline-flex items-center gap-2 text-sm font-semibold ${settings.ready ? "text-emerald-700" : "text-red-dark"}`}>
          {settings.ready ? <><CheckCircle size={16} weight="fill" /> Ready: students can pay</> : <><Warning size={16} weight="fill" /> Not set up: paid courses can&apos;t be bought yet</>}
        </p>
      ) : (
        <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6" noValidate>
          <div className="flex flex-col gap-2">
            <div className="aspect-square rounded-2xl border-2 border-line bg-white flex items-center justify-center overflow-hidden">
              {shown ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shown} alt="Payment QR code" className="w-full h-full object-contain p-2" />
              ) : (
                <QrCode size={48} weight="duotone" className="text-ink-muted" />
              )}
            </div>
            <label className="btn btn-sm btn-outline inline-flex items-center justify-center gap-1.5 cursor-pointer">
              <UploadSimple size={14} /> {shown ? "Replace image" : "Upload QR image"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
            {errors.qr_image && <p className="text-xs text-red-dark">{errors.qr_image}</p>}
          </div>

          <div className="flex flex-col gap-4">
            <TextField id="qr-name" label="Account holder" value={form.account_name} onChange={set("account_name")} error={errors.account_name} placeholder="e.g. Norbu Tshering" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField id="qr-bank" label="Bank" value={form.bank_name} onChange={set("bank_name")} error={errors.bank_name} placeholder="e.g. Bank of Bhutan (mBoB)" />
              <TextField id="qr-account" label="Account no. (optional)" value={form.account_number} onChange={set("account_number")} error={errors.account_number} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="qr-alert" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Email for payment alerts</label>
              <input id="qr-alert" type="email" value={form.alert_email} onChange={set("alert_email")} className={inputClass} placeholder="e.g. owner@gmail.com" aria-invalid={!!errors.alert_email} aria-describedby="qr-alert-hint" />
              <p id="qr-alert-hint" className={`text-xs ${errors.alert_email ? "text-red-dark" : "text-ink-muted"}`}>
                {errors.alert_email || "The account holder's Gmail. It gets an email with the screenshot the moment a student submits a payment. Leave empty to email every admin."}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="qr-notes" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Note for students (optional)</label>
              <textarea id="qr-notes" rows={2} value={form.instructions} onChange={set("instructions")} className={`${inputClass} resize-y`} placeholder="e.g. Payments are verified within 24 hours." />
            </div>
            <div>
              <button type="submit" disabled={saving} className="btn btn-md btn-primary disabled:opacity-70">{saving ? "Saving…" : "Save QR details"}</button>
            </div>
          </div>
        </form>
      )}
    </Card>
  );
}

function TextField({ id, label, value, onChange, error, placeholder }: {
  id: string; label: string; value: string; error?: string; placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold text-ink-strong uppercase tracking-wider">{label}</label>
      <input id={id} value={value} onChange={onChange} placeholder={placeholder} className={inputClass} aria-invalid={!!error} />
      {error && <p className="text-xs text-red-dark">{error}</p>}
    </div>
  );
}
