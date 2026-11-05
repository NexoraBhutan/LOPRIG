"use client";

import { useEffect, useRef, useState } from "react";
import { FloppyDisk, ImageSquare, Trash } from "@phosphor-icons/react";
import { CoverArt } from "@/components/CourseThumb";
import { useCatalog } from "@/context/CatalogContext";
import { useToast } from "@/context/ToastContext";
import { api, errorMessage } from "@/lib/api";
import { LEVELS, fieldErrors, formatMoney, inputClass, type CourseInput, type TeachCourse } from "@/lib/teach";
import Field from "@/components/teach/Field";
import { useSiteConfig } from "@/lib/siteConfig";

const SWATCHES: [string, string][] = [
  ["#ffb606", "#c88e00"],
  ["#1a1a1a", "#ffb606"],
  ["#ff6347", "#ffb606"],
  ["#0f766e", "#14b8a6"],
  ["#1e3a8a", "#3b82f6"],
  ["#6d28d9", "#c084fc"],
];

const COVER_TYPES = ["image/png", "image/jpeg", "image/webp"];
const COVER_MAX_MB = 5;

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

/** Create (no `course`) or edit a course's details. Calls onSaved with the API's response. */
export default function CourseForm({
  course,
  onSaved,
}: {
  course?: TeachCourse;
  onSaved: (course: TeachCourse) => void;
}) {
  const { categories } = useCatalog();
  const { push } = useToast();
  const [form, setForm] = useState({
    title: course?.title ?? "",
    description: course?.description ?? "",
    category: course?.category ?? "",
    level: course?.level ?? "Beginner",
    language: course?.language ?? "English",
    price: course ? String(course.price) : "",
    discount_price: course?.discount_price != null ? String(course.discount_price) : "",
    what_you_learn: course?.what_you_learn.join("\n") ?? "",
    requirements: course?.requirements.join("\n") ?? "",
    gradient_start: course?.gradient_start ?? SWATCHES[0][0],
    gradient_end: course?.gradient_end ?? SWATCHES[0][1],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // Cover image: a newly picked file, or the course's saved one unless the teacher removed it.
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [coverPreview, setCoverPreview] = useState("");
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!coverFile) return setCoverPreview("");
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const cover = coverPreview || (coverRemoved ? "" : course?.thumbnail_url ?? "");

  const pickCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // picking the same file again should still fire
    if (!file) return;
    if (!COVER_TYPES.includes(file.type)) {
      setErrors((x) => ({ ...x, cover: "Use a PNG, JPG or WebP image." }));
      return;
    }
    if (file.size > COVER_MAX_MB * 1024 * 1024) {
      setErrors((x) => ({ ...x, cover: `The image is too large. The limit is ${COVER_MAX_MB} MB.` }));
      return;
    }
    setErrors(({ cover: _, ...rest }) => rest);
    setCoverFile(file);
    setCoverRemoved(false);
  };

  const removeCover = () => {
    setCoverFile(null);
    setCoverRemoved(true);
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const config = useSiteConfig();
  const price = Number(form.price) || 0;
  const sale = form.discount_price === "" ? null : Number(form.discount_price);
  const categoryTitle = categories.find((c) => c.id === form.category)?.title ?? "Category";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    const body: CourseInput = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      level: form.level,
      language: form.language.trim() || "English",
      price,
      discount_price: sale,
      what_you_learn: lines(form.what_you_learn),
      requirements: lines(form.requirements),
      gradient_start: form.gradient_start,
      gradient_end: form.gradient_end,
    };
    try {
      let saved = course
        ? await api<TeachCourse>(`/teach/courses/${course.id}/`, { method: "PATCH", body })
        : await api<TeachCourse>("/teach/courses/", { method: "POST", body });
      try {
        if (coverFile) {
          const data = new FormData();
          data.append("image", coverFile);
          saved = await api<TeachCourse>(`/teach/courses/${saved.id}/cover/`, { method: "POST", body: data });
        } else if (coverRemoved && course?.thumbnail_url) {
          saved = await api<TeachCourse>(`/teach/courses/${saved.id}/cover/`, { method: "DELETE" });
        }
      } catch (coverErr) {
        // The course itself is saved; only the image failed.
        push(`Course saved, but the cover image wasn't: ${fieldErrors(coverErr).image ?? errorMessage(coverErr)}`, "error");
      }
      onSaved(saved);
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      push(Object.keys(fields).length ? "Please fix the highlighted fields." : errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const err = (k: string) => errors[k];
  const aria = (k: string) => (errors[k] ? { "aria-invalid": true, "aria-describedby": `${k}-error` } : {});

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start" noValidate>
      <div className="flex flex-col gap-6">
        <section className="bg-white border-2 border-line rounded-2xl p-6 md:p-8 flex flex-col gap-5">
          <h2 className="font-display text-xl font-semibold text-ink-strong">Basics</h2>
          <Field id="title" label="Course title" error={err("title")} hint="Say what students will be able to do, e.g. “Python for Beginners”.">
            <input id="title" value={form.title} onChange={set("title")} className={inputClass} required maxLength={200} {...aria("title")} />
          </Field>
          <Field id="description" label="Description" error={err("description")} hint="Who is this for and what will they learn? At least 30 characters.">
            <textarea id="description" rows={5} value={form.description} onChange={set("description")} className={`${inputClass} resize-y`} {...aria("description")} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Field id="category" label="Category" error={err("category")}>
              <select id="category" value={form.category} onChange={set("category")} className={inputClass} required {...aria("category")}>
                <option value="" disabled>Choose…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </Field>
            <Field id="level" label="Level" error={err("level")}>
              <select id="level" value={form.level} onChange={set("level")} className={inputClass}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <Field id="language" label="Language" error={err("language")}>
              <input id="language" value={form.language} onChange={set("language")} className={inputClass} />
            </Field>
          </div>
        </section>

        <section className="bg-white border-2 border-line rounded-2xl p-6 md:p-8 flex flex-col gap-5">
          <h2 className="font-display text-xl font-semibold text-ink-strong">Outcomes</h2>
          <Field id="what_you_learn" label="What students will learn" error={err("what_you_learn")} hint="One outcome per line.">
            <textarea id="what_you_learn" rows={5} value={form.what_you_learn} onChange={set("what_you_learn")} className={`${inputClass} resize-y`} placeholder={"Write and run Python programs\nWork with loops and functions"} {...aria("what_you_learn")} />
          </Field>
          <Field id="requirements" label="Requirements" error={err("requirements")} hint="One per line. Leave empty if there are none.">
            <textarea id="requirements" rows={3} value={form.requirements} onChange={set("requirements")} className={`${inputClass} resize-y`} placeholder="A laptop or desktop computer" />
          </Field>
        </section>

        <section className="bg-white border-2 border-line rounded-2xl p-6 md:p-8 flex flex-col gap-5">
          <h2 className="font-display text-xl font-semibold text-ink-strong">Pricing</h2>
          {config && !config.payments_enabled && (
            <p className="rounded-xl bg-gold-soft/60 px-4 py-3 text-sm text-ink">
              <strong className="text-ink-strong">Payments are switched off for now.</strong> Students enroll in every
              course for free. The price you set here is saved and will apply once payments open.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field
              id="price"
              label="Price (Nu.)"
              error={err("price")}
              hint="0 = free: once approved, anyone can watch every lesson without enrolling. Paid courses unlock after the student's QR payment is verified."
            >
              <input id="price" type="number" min={0} step={1} inputMode="numeric" value={form.price} onChange={set("price")} className={inputClass} required {...aria("price")} />
            </Field>
            <Field id="discount_price" label="Sale price (Nu.)" error={err("discount_price")} hint="Optional. What students pay during a sale.">
              <input id="discount_price" type="number" min={0} step={1} inputMode="numeric" value={form.discount_price} onChange={set("discount_price")} className={inputClass} {...aria("discount_price")} />
            </Field>
          </div>
        </section>
      </div>

      <aside className="flex flex-col gap-5 lg:sticky lg:top-8">
        <div className="bg-white border-2 border-line rounded-2xl overflow-hidden">
          <CoverArt src={cover} gradient={[form.gradient_start, form.gradient_end]} className="aspect-video">
            <span className="absolute bottom-3 left-3 bg-white/90 text-ink-strong text-[0.65rem] font-bold px-2.5 py-1 rounded tracking-wider uppercase">{categoryTitle}</span>
          </CoverArt>
          <div className="p-5">
            <p className="text-[0.7rem] font-bold text-gold-dark uppercase tracking-wider">Preview · {form.level}</p>
            <h3 className="text-sm font-semibold text-ink-strong mt-1.5 leading-snug line-clamp-2">{form.title || "Your course title"}</h3>
            <div className="flex items-center gap-2 mt-3">
              <strong className="text-sm font-bold text-ink-strong">{price === 0 ? "Free" : formatMoney(sale ?? price)}</strong>
              {sale !== null && sale < price && <span className="text-xs text-ink-muted line-through">{formatMoney(price)}</span>}
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-line rounded-2xl p-5">
          <p className="text-xs font-bold text-ink-strong uppercase tracking-wider mb-1">Cover image</p>
          <p className="text-xs text-ink-muted mb-3">Shown on the course card. Landscape 16:9 works best (e.g. 1280×720). PNG, JPG or WebP, up to {COVER_MAX_MB} MB.</p>
          <input ref={coverInput} id="cover" type="file" accept={COVER_TYPES.join(",")} onChange={pickCover} className="sr-only" aria-describedby={errors.cover ? "cover-error" : undefined} />
          <div className="flex gap-2">
            <button type="button" onClick={() => coverInput.current?.click()} className="flex-1 flex items-center justify-center gap-2 border-2 border-line rounded-xl py-2.5 text-xs font-bold text-ink-strong bg-bg-soft hover:border-gold transition-colors cursor-pointer">
              <ImageSquare size={16} weight="bold" /> {cover ? "Change image" : "Upload image"}
            </button>
            {cover && (
              <button type="button" onClick={removeCover} className="flex items-center justify-center px-3 border-2 border-line rounded-xl text-ink-muted hover:text-red-600 hover:border-red-200 bg-white transition-colors cursor-pointer" aria-label="Remove cover image">
                <Trash size={16} weight="bold" />
              </button>
            )}
          </div>
          {errors.cover && <p id="cover-error" role="alert" className="text-xs text-red-600 font-semibold mt-2">{errors.cover}</p>}
          {coverFile && <p className="text-xs text-ink-muted mt-2 truncate">New image: {coverFile.name} (saved with the course)</p>}
        </div>

        <fieldset className="bg-white border-2 border-line rounded-2xl p-5">
          <legend className="sr-only">Card colours</legend>
          <p className="text-xs font-bold text-ink-strong uppercase tracking-wider mb-1" aria-hidden="true">Card colours</p>
          <p className="text-xs text-ink-muted mb-3">{cover ? "Used if the image is removed." : "Used when there's no cover image."}</p>
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map(([a, b]) => {
              const active = form.gradient_start === a && form.gradient_end === b;
              return (
                <button
                  key={a + b}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, gradient_start: a, gradient_end: b }))}
                  aria-label={`Use colours ${a} and ${b}`}
                  aria-pressed={active}
                  className={`w-9 h-9 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 ${active ? "border-ink-strong scale-110" : "border-white shadow-soft"}`}
                  style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
                />
              );
            })}
          </div>
        </fieldset>

        <button type="submit" disabled={saving} className="btn btn-primary btn-lg btn-block disabled:opacity-60 disabled:cursor-wait">
          <FloppyDisk size={16} weight="bold" /> {saving ? "Saving…" : course ? "Save changes" : "Create course"}
        </button>
      </aside>
    </form>
  );
}
