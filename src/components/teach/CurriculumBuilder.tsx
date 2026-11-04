"use client";

import { useEffect, useRef, useState } from "react";
import {
  VideoCamera, Article, PuzzlePiece, PencilSimple, Trash, ArrowUp, ArrowDown, Plus,
  Check, X, LinkSimple, Eye, Warning, CircleNotch,
} from "@phosphor-icons/react";
import { useToast } from "@/context/ToastContext";
import { api, errorMessage } from "@/lib/api";
import {
  fieldErrors, formatClock, inputClass, parseDuration,
  type LessonKind, type TeachCourse, type TeachLesson, type TeachModule,
} from "@/lib/teach";
import Field from "@/components/teach/Field";
import VideoUpload from "@/components/teach/VideoUpload";
import VideoFrame from "@/components/VideoFrame";

const KINDS: { value: LessonKind; label: string; icon: typeof VideoCamera }[] = [
  { value: "VIDEO", label: "Video", icon: VideoCamera },
  { value: "TEXT", label: "Reading", icon: Article },
  { value: "H5P", label: "Interactive", icon: PuzzlePiece },
];

const iconButton =
  "w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink-strong hover:bg-bg-soft bg-transparent border-none cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed";

/** Persist a new order for a list after moving item `from` to `to` (only changed rows are sent). */
async function saveOrder<T extends { id: number; order: number }>(items: T[], from: number, to: number, path: (id: number) => string) {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  await Promise.all(
    next.map((item, index) =>
      item.order === index ? null : api(path(item.id), { method: "PATCH", body: { order: index } })
    )
  );
}

type Run = (action: () => Promise<unknown>, success?: string) => Promise<boolean>;

const VIDEO_POLL_MS = 5000;

export default function CurriculumBuilder({ course, onChange }: { course: TeachCourse; onChange: () => Promise<void> }) {
  const { push } = useToast();
  const modules = course.modules ?? [];
  const [newModule, setNewModule] = useState("");
  const [busy, setBusy] = useState(false);

  // Bunny processes uploads in the background. Ask about every processing video until it's done,
  // whether or not its editor is open (on a deployed site Bunny's webhook usually answers first).
  const processing = modules
    .flatMap((m) => m.lessons)
    .filter((l) => l.has_upload && l.video_status === "PROCESSING")
    .map((l) => l.id)
    .join(",");
  const reload = useRef(onChange);
  useEffect(() => {
    reload.current = onChange;
  }, [onChange]);
  useEffect(() => {
    if (!processing) return;
    const check = async () => {
      await Promise.all(
        processing.split(",").map((id) => api(`/teach/lessons/${id}/video/`, { method: "POST" }).catch(() => undefined))
      );
      await reload.current().catch(() => undefined);
    };
    check();
    const timer = setInterval(check, VIDEO_POLL_MS);
    return () => clearInterval(timer);
  }, [processing]);

  /** Run a change, reload the course, toast the outcome. Resolves true on success. */
  const run: Run = async (action, success) => {
    setBusy(true);
    try {
      await action();
      await onChange();
      if (success) push(success, "success");
      return true;
    } catch (err) {
      push(errorMessage(err), "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addModule = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newModule.trim();
    if (!title) return;
    if (await run(() => api(`/teach/courses/${course.id}/modules/`, { method: "POST", body: { title } }), "Module added")) {
      setNewModule("");
    }
  };

  const totalLessons = modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <div className="flex flex-col gap-5" aria-busy={busy}>
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink-strong">Curriculum</h2>
        <p className="text-sm text-ink-muted">
          {modules.length} module{modules.length === 1 ? "" : "s"} · {totalLessons} lesson{totalLessons === 1 ? "" : "s"} · {course.duration} of content
        </p>
      </div>

      {modules.length === 0 && (
        <div className="bg-white border-2 border-dashed border-line-strong rounded-2xl p-8 text-center">
          <p className="font-semibold text-ink-strong">Start with a module</p>
          <p className="text-sm text-ink-muted mt-1">Modules group your lessons, e.g. “Getting started”, “Core skills”, “Final project”.</p>
        </div>
      )}

      {modules.map((module, index) => (
        <ModuleCard
          key={module.id}
          module={module}
          index={index}
          isLast={index === modules.length - 1}
          busy={busy}
          run={run}
          onMove={(to) => run(() => saveOrder(modules, index, to, (id) => `/teach/modules/${id}/`))}
        />
      ))}

      <form onSubmit={addModule} className="flex flex-col sm:flex-row gap-3 bg-white border-2 border-line rounded-2xl p-4">
        <label htmlFor="new-module" className="sr-only">New module title</label>
        <input
          id="new-module"
          value={newModule}
          onChange={(e) => setNewModule(e.target.value)}
          placeholder={modules.length ? "Next module title, e.g. “Working with data”" : "First module title, e.g. “Getting started”"}
          className={`${inputClass} flex-1`}
          maxLength={200}
        />
        <button type="submit" disabled={busy || !newModule.trim()} className="btn btn-md btn-secondary disabled:opacity-50">
          <Plus size={14} weight="bold" /> Add module
        </button>
      </form>
    </div>
  );
}

function ModuleCard({
  module, index, isLast, busy, run, onMove,
}: {
  module: TeachModule;
  index: number;
  isLast: boolean;
  busy: boolean;
  run: Run;
  onMove: (to: number) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(module.title);
  const [editingLesson, setEditingLesson] = useState<number | "new" | null>(null);

  const saveTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run(() => api(`/teach/modules/${module.id}/`, { method: "PATCH", body: { title: title.trim() } }), "Module renamed")) {
      setEditingTitle(false);
    }
  };

  const removeModule = () => {
    const warning = module.lessons.length
      ? `Delete “${module.title}” and its ${module.lessons.length} lesson(s)? Students lose progress on those lessons.`
      : `Delete “${module.title}”?`;
    if (window.confirm(warning)) run(() => api(`/teach/modules/${module.id}/`, { method: "DELETE" }), "Module deleted");
  };

  return (
    <section className="bg-white border-2 border-line rounded-2xl overflow-hidden" aria-labelledby={`module-${module.id}`}>
      <header className="flex items-center gap-2 px-5 py-4 bg-bg-soft border-b border-line">
        <span className="w-8 h-8 mr-1 rounded-lg bg-ink-strong text-gold text-xs font-bold flex items-center justify-center flex-shrink-0">{index + 1}</span>
        {editingTitle ? (
          <form onSubmit={saveTitle} className="flex flex-1 items-center gap-2">
            <label htmlFor={`module-title-${module.id}`} className="sr-only">Module title</label>
            <input id={`module-title-${module.id}`} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputClass} py-2`} maxLength={200} />
            <button type="submit" className={iconButton} aria-label="Save module title"><Check size={16} weight="bold" /></button>
            <button type="button" className={iconButton} aria-label="Cancel" onClick={() => { setTitle(module.title); setEditingTitle(false); }}><X size={16} weight="bold" /></button>
          </form>
        ) : (
          <>
            <h3 id={`module-${module.id}`} className="flex-1 min-w-0 font-semibold text-ink-strong truncate">{module.title}</h3>
            <button className={iconButton} onClick={() => setEditingTitle(true)} aria-label={`Rename ${module.title}`}><PencilSimple size={16} /></button>
            <button className={iconButton} onClick={() => onMove(index - 1)} disabled={busy || index === 0} aria-label="Move module up"><ArrowUp size={16} /></button>
            <button className={iconButton} onClick={() => onMove(index + 1)} disabled={busy || isLast} aria-label="Move module down"><ArrowDown size={16} /></button>
            <button className={`${iconButton} hover:!text-red-dark hover:!bg-red-soft`} onClick={removeModule} disabled={busy} aria-label={`Delete ${module.title}`}><Trash size={16} /></button>
          </>
        )}
      </header>

      <ol className="divide-y divide-line">
        {module.lessons.map((lesson, li) => (
          <li key={lesson.id}>
            {editingLesson === lesson.id ? (
              <LessonEditor moduleId={module.id} lesson={lesson} run={run} onDone={() => setEditingLesson(null)} />
            ) : (
              <LessonRow
                lesson={lesson}
                index={li}
                isLast={li === module.lessons.length - 1}
                busy={busy}
                onEdit={() => setEditingLesson(lesson.id)}
                onMove={(to) => run(() => saveOrder(module.lessons, li, to, (id) => `/teach/lessons/${id}/`))}
                onDelete={() => {
                  if (window.confirm(`Delete the lesson “${lesson.title}”?`)) {
                    run(() => api(`/teach/lessons/${lesson.id}/`, { method: "DELETE" }), "Lesson deleted");
                  }
                }}
              />
            )}
          </li>
        ))}
      </ol>

      {editingLesson === "new" ? (
        <div className="border-t border-line">
          <LessonEditor
            moduleId={module.id}
            run={run}
            onDone={() => setEditingLesson(null)}
            onCreatedNeedsVideo={(id) => setEditingLesson(id)}
          />
        </div>
      ) : (
        <button
          onClick={() => setEditingLesson("new")}
          className="w-full flex items-center justify-center gap-2 py-3.5 border-0 border-t border-line border-solid text-sm font-bold text-gold-dark hover:bg-gold-soft/50 bg-transparent cursor-pointer transition-colors"
        >
          <Plus size={14} weight="bold" /> Add lesson
        </button>
      )}
    </section>
  );
}

function LessonRow({
  lesson, index, isLast, busy, onEdit, onMove, onDelete,
}: {
  lesson: TeachLesson;
  index: number;
  isLast: boolean;
  busy: boolean;
  onEdit: () => void;
  onMove: (to: number) => void;
  onDelete: () => void;
}) {
  const Kind = KINDS.find((k) => k.value === lesson.kind) ?? KINDS[0];
  const missingVideo = lesson.kind === "VIDEO" && !lesson.video_url && !lesson.has_upload;
  const videoBusy = lesson.has_upload && (lesson.video_status === "PROCESSING" || lesson.video_status === "UPLOADING");
  const videoFailed = lesson.has_upload && lesson.video_status === "FAILED";
  return (
    <div className="flex items-center gap-2 px-5 py-3 hover:bg-bg-soft/60 transition-colors">
      <span className="w-8 h-8 mr-1 rounded-lg bg-gold-soft text-gold-dark flex items-center justify-center flex-shrink-0" title={Kind.label}>
        <Kind.icon size={16} weight="duotone" />
      </span>
      <button onClick={onEdit} className="flex-1 min-w-0 text-left bg-transparent border-none cursor-pointer p-0">
        <span className="block text-sm font-medium text-ink-strong truncate">{lesson.title}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-xs text-ink-muted">
          {formatClock(lesson.duration_seconds)}
          {lesson.is_preview && <span className="inline-flex items-center gap-1 text-gold-dark font-semibold"><Eye size={12} /> Free preview</span>}
          {lesson.resources.length > 0 && <span className="inline-flex items-center gap-1"><LinkSimple size={12} /> {lesson.resources.length} resource{lesson.resources.length === 1 ? "" : "s"}</span>}
          {missingVideo && <span className="inline-flex items-center gap-1 text-red-dark font-semibold"><Warning size={12} /> No video yet</span>}
          {videoBusy && <span className="inline-flex items-center gap-1 text-gold-dark font-semibold"><CircleNotch size={12} className="animate-spin" /> Video processing</span>}
          {videoFailed && <span className="inline-flex items-center gap-1 text-red-dark font-semibold"><Warning size={12} /> Video failed, upload again</span>}
        </span>
      </button>
      <button className={iconButton} onClick={onEdit} aria-label={`Edit ${lesson.title}`}><PencilSimple size={16} /></button>
      <button className={iconButton} onClick={() => onMove(index - 1)} disabled={busy || index === 0} aria-label="Move lesson up"><ArrowUp size={16} /></button>
      <button className={iconButton} onClick={() => onMove(index + 1)} disabled={busy || isLast} aria-label="Move lesson down"><ArrowDown size={16} /></button>
      <button className={`${iconButton} hover:!text-red-dark hover:!bg-red-soft`} onClick={onDelete} disabled={busy} aria-label={`Delete ${lesson.title}`}><Trash size={16} /></button>
    </div>
  );
}

function LessonEditor({
  moduleId, lesson, run, onDone, onCreatedNeedsVideo,
}: {
  moduleId: number;
  lesson?: TeachLesson;
  run: Run;
  onDone: () => void;
  /** A new video lesson without a link: keep editing it so the teacher can upload the file right away. */
  onCreatedNeedsVideo?: (id: number) => void;
}) {
  const [form, setForm] = useState({
    title: lesson?.title ?? "",
    kind: lesson?.kind ?? ("VIDEO" as LessonKind),
    duration: lesson ? formatClock(lesson.duration_seconds) : "",
    video_url: lesson?.video_url ?? "",
    h5p_embed_url: lesson?.h5p_embed_url ?? "",
    body: lesson?.body ?? "",
    is_preview: lesson?.is_preview ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resource, setResource] = useState({ title: "", url: "" });
  const uid = lesson ? `l${lesson.id}` : `new${moduleId}`;
  // An uploaded video replaces any pasted link and Bunny measures its length, so while there is an
  // upload the form shows (and saves) neither an old link nor a hand-typed duration.
  const uploaded = !!lesson?.has_upload && form.kind === "VIDEO";
  const [linkEdited, setLinkEdited] = useState(false);
  const videoLink = uploaded && !linkEdited ? "" : form.video_url;
  const duration = uploaded ? formatClock(lesson.duration_seconds) : form.duration;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const body = {
      title: form.title.trim(),
      kind: form.kind,
      ...(uploaded ? {} : { duration_seconds: parseDuration(form.duration) }),
      video_url: videoLink.trim(),
      h5p_embed_url: form.h5p_embed_url.trim(),
      body: form.body,
      is_preview: form.is_preview,
    };
    const needsUpload = !lesson && body.kind === "VIDEO" && !body.video_url;
    let createdId: number | null = null;
    const ok = await run(async () => {
      try {
        if (lesson) await api(`/teach/lessons/${lesson.id}/`, { method: "PATCH", body });
        else createdId = (await api<TeachLesson>(`/teach/modules/${moduleId}/lessons/`, { method: "POST", body })).id;
      } catch (err) {
        setErrors(fieldErrors(err));
        throw err;
      }
    }, lesson ? "Lesson saved" : needsUpload ? "Lesson added. Now upload its video." : "Lesson added");
    if (!ok) return;
    if (needsUpload && createdId !== null && onCreatedNeedsVideo) onCreatedNeedsVideo(createdId);
    else onDone();
  };

  const addResource = async () => {
    if (!lesson || !resource.title.trim() || !resource.url.trim()) return;
    const body = { title: resource.title.trim(), url: resource.url.trim() };
    if (await run(() => api(`/teach/lessons/${lesson.id}/resources/`, { method: "POST", body }), "Resource added")) {
      setResource({ title: "", url: "" });
    }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <form onSubmit={save} className="p-5 bg-gold-soft/30 flex flex-col gap-4">
      <Field id={`${uid}-title`} label="Lesson title" error={errors.title}>
        <input id={`${uid}-title`} autoFocus value={form.title} onChange={set("title")} className={inputClass} required maxLength={200} />
      </Field>

      <fieldset>
        <legend className="text-xs font-bold text-ink-strong uppercase tracking-wider mb-2">Type</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, kind: value }))}
              aria-pressed={form.kind === value}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border-2 border-solid cursor-pointer transition-colors ${
                form.kind === value ? "bg-ink-strong text-white border-ink-strong" : "bg-white text-ink border-line hover:border-gold"
              }`}
            >
              <Icon size={15} weight={form.kind === value ? "fill" : "regular"} /> {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4">
        <Field
          id={`${uid}-duration`}
          label="Duration"
          hint={uploaded ? "Set from the uploaded video." : "m:ss, e.g. 7:30"}
          error={errors.duration_seconds}
        >
          <input
            id={`${uid}-duration`}
            value={duration}
            onChange={set("duration")}
            readOnly={uploaded}
            className={`${inputClass} read-only:bg-bg-soft read-only:text-ink-muted`}
            placeholder="7:30"
            inputMode="numeric"
          />
        </Field>
        {form.kind === "H5P" && (
          <Field id={`${uid}-h5p`} label="H5P embed link" error={errors.h5p_embed_url}>
            <input id={`${uid}-h5p`} type="url" value={form.h5p_embed_url} onChange={set("h5p_embed_url")} className={inputClass} placeholder="https://…" />
          </Field>
        )}
      </div>

      {form.kind === "VIDEO" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-ink-strong uppercase tracking-wider">Video</p>
          {lesson ? (
            <VideoUpload lesson={lesson} run={run} />
          ) : (
            <p className="text-sm text-ink-muted">
              Click <strong className="text-ink-strong">Add lesson</strong> below. The upload button then appears right here, or paste a link instead.
            </p>
          )}
          <Field
            id={`${uid}-video`}
            label="Or paste a link"
            hint={lesson?.has_upload ? "YouTube or Vimeo. Saving a link replaces the uploaded video." : "YouTube (unlisted) or Vimeo. Anyone with the link can watch, so upload paid lessons instead."}
            error={errors.video_url}
          >
            <input
              id={`${uid}-video`}
              type="url"
              value={videoLink}
              onChange={(e) => { setLinkEdited(true); set("video_url")(e); }}
              className={inputClass}
              placeholder="https://youtu.be/…"
            />
          </Field>
          {lesson && !lesson.has_upload && lesson.playback.url && (
            <div className="flex flex-col gap-2">
              <div className="rounded-2xl overflow-hidden border border-line bg-black">
                <VideoFrame playback={lesson.playback} title={`Preview of ${lesson.title}`} className="w-full aspect-video" />
              </div>
              <p className="text-xs text-ink-muted">
                Check it plays here. If YouTube says &ldquo;Video unavailable&rdquo;, its owner blocks other websites:
                pick another video or upload the file.
              </p>
            </div>
          )}
        </div>
      )}

      <Field id={`${uid}-body`} label={form.kind === "TEXT" ? "Reading content" : "Lesson notes"} hint="Shown to students under the lesson.">
        <textarea id={`${uid}-body`} rows={form.kind === "TEXT" ? 8 : 3} value={form.body} onChange={set("body")} className={`${inputClass} resize-y`} />
      </Field>

      <label className="flex items-start gap-3 text-sm text-ink cursor-pointer">
        <input type="checkbox" checked={form.is_preview} onChange={(e) => setForm((f) => ({ ...f, is_preview: e.target.checked }))} className="w-4 h-4 mt-0.5 accent-gold" />
        <span><strong className="font-semibold text-ink-strong">Free preview</strong>: anyone can watch this lesson before enrolling.</span>
      </label>

      {lesson && (
        <div className="flex flex-col gap-3 pt-4 border-t border-line">
          <p className="text-xs font-bold text-ink-strong uppercase tracking-wider">Resources</p>
          {lesson.resources.length > 0 && (
            <ul className="flex flex-col gap-2">
              {lesson.resources.map((r) => (
                <li key={r.id} className="flex items-center gap-3 bg-white border border-line rounded-xl px-4 py-2.5">
                  <LinkSimple size={15} className="text-gold-dark flex-shrink-0" />
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-sm text-ink-strong truncate hover:text-gold-dark">{r.title}</a>
                  <button
                    type="button"
                    className={`${iconButton} w-8 h-8 hover:!text-red-dark`}
                    aria-label={`Remove ${r.title}`}
                    onClick={() => run(() => api(`/teach/resources/${r.id}/`, { method: "DELETE" }), "Resource removed")}
                  >
                    <X size={14} weight="bold" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <label htmlFor={`${uid}-res-title`} className="sr-only">Resource title</label>
            <input id={`${uid}-res-title`} value={resource.title} onChange={(e) => setResource((r) => ({ ...r, title: e.target.value }))} placeholder="Title, e.g. Slides (PDF)" className={`${inputClass} sm:w-56`} />
            <label htmlFor={`${uid}-res-url`} className="sr-only">Resource link</label>
            <input id={`${uid}-res-url`} type="url" value={resource.url} onChange={(e) => setResource((r) => ({ ...r, url: e.target.value }))} placeholder="https://…" className={`${inputClass} flex-1`} />
            <button type="button" onClick={addResource} disabled={!resource.title.trim() || !resource.url.trim()} className="btn btn-md btn-outline disabled:opacity-50">Add</button>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="submit" className="btn btn-md btn-primary">{lesson ? "Save lesson" : "Add lesson"}</button>
        <button type="button" onClick={onDone} className="btn btn-md btn-outline-neutral">Cancel</button>
      </div>
    </form>
  );
}
