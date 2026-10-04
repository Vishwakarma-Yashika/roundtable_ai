"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import type { NewPerspectiveInput } from "@/lib/meeting/types";
import { CloseIcon, PlusIcon } from "./icons";

const SUGGESTIONS: NewPerspectiveInput[] = [
  {
    name: "Priya Nair",
    role: "Legal Advisor",
    focus: "Regulatory exposure, contracts and liability",
  },
  {
    name: "Jonas Weber",
    role: "Privacy Advocate",
    focus: "How user data is collected, stored and protected",
  },
  {
    name: "Lena Ortiz",
    role: "Competitor",
    focus: "How an established rival would respond and where they'd attack",
  },
  {
    name: "Tom Hale",
    role: "Financial Advisor",
    focus: "Personal runway, savings and the cost of being wrong",
  },
];

const LIMITS = { name: 40, role: 40, focus: 240 } as const;

interface AddPerspectiveModalProps {
  open: boolean;
  existingNames: string[];
  onClose: () => void;
  onAdd: (input: NewPerspectiveInput) => void;
}

export function AddPerspectiveModal({ open, existingNames, onClose, onAdd }: AddPerspectiveModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="add-perspective-title"
      describedBy="add-perspective-description"
    >
      <AddPerspectiveForm existingNames={existingNames} onClose={onClose} onAdd={onAdd} />
    </Modal>
  );
}

function AddPerspectiveForm({
  existingNames,
  onClose,
  onAdd,
}: Omit<AddPerspectiveModalProps, "open">) {
  const [values, setValues] = useState<NewPerspectiveInput>({ name: "", role: "", focus: "" });
  const [submitted, setSubmitted] = useState(false);

  const nameTaken = existingNames.some(
    (name) => name.toLowerCase() === values.name.trim().toLowerCase()
  );
  const errors = {
    name: !values.name.trim()
      ? "Give this perspective a name."
      : nameTaken
        ? "Someone with this name is already in the room."
        : null,
    role: !values.role.trim() ? "Add a role, like “Legal Advisor”." : null,
    focus: !values.focus.trim() ? "Describe what this perspective should focus on." : null,
  };
  const valid = !errors.name && !errors.role && !errors.focus;

  const update = (field: keyof NewPerspectiveInput, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    onAdd({
      name: values.name.trim(),
      role: values.role.trim(),
      focus: values.focus.trim(),
    });
  };

  const availableSuggestions = SUGGESTIONS.filter(
    (s) => !existingNames.some((name) => name.toLowerCase() === s.name.toLowerCase())
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] p-6 pb-5">
        <div>
          <h2 id="add-perspective-title" className="text-lg font-semibold tracking-tight">
            Add a perspective
          </h2>
          <p id="add-perspective-description" className="mt-1 text-sm text-zinc-500">
            They&apos;ll join with the context of the discussion so far.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5 p-6">
        {availableSuggestions.length > 0 && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-600">
              Quick picks
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {availableSuggestions.map((suggestion) => (
                <button
                  key={suggestion.role}
                  type="button"
                  onClick={() => setValues(suggestion)}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 transition hover:border-violet-400/30 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400"
                >
                  {suggestion.role}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="perspective-name"
            label="Name"
            placeholder="e.g. Priya Nair"
            value={values.name}
            maxLength={LIMITS.name}
            error={submitted ? errors.name : null}
            onChange={(value) => update("name", value)}
            autoFocus
          />
          <Field
            id="perspective-role"
            label="Role"
            placeholder="e.g. Legal Advisor"
            value={values.role}
            maxLength={LIMITS.role}
            error={submitted ? errors.role : null}
            onChange={(value) => update("role", value)}
          />
        </div>

        <Field
          id="perspective-focus"
          label="What should they focus on?"
          placeholder="e.g. Regulatory exposure, contracts and liability"
          value={values.focus}
          maxLength={LIMITS.focus}
          error={submitted ? errors.focus : null}
          onChange={(value) => update("focus", value)}
          multiline
        />
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-white/[0.06] p-6 pt-5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
        >
          <PlusIcon className="h-4 w-4" />
          Add to the room
        </button>
      </div>
    </form>
  );
}

interface FieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  maxLength: number;
  error: string | null;
  onChange: (value: string) => void;
  multiline?: boolean;
  autoFocus?: boolean;
}

function Field({
  id,
  label,
  placeholder,
  value,
  maxLength,
  error,
  onChange,
  multiline = false,
  autoFocus = false,
}: FieldProps) {
  const inputClass = `w-full rounded-xl border bg-black/30 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400/40 focus:bg-black/40 ${
    error ? "border-rose-400/40" : "border-white/10"
  }`;
  const errorId = `${id}-error`;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs font-medium text-zinc-300">
          {label}
        </label>
        {multiline && (
          <span className="text-[11px] tabular-nums text-zinc-600">
            {value.length}/{maxLength}
          </span>
        )}
      </div>

      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} resize-none leading-6`}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          data-autofocus={autoFocus || undefined}
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}

      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
