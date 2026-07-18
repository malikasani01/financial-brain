'use client';

import { useRef, useState, type ReactNode } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import {
  REMINDER_CATEGORIES,
  REMINDER_PRIORITIES,
  type RelatedOption,
} from '@/lib/reminder-options';
import type { ReminderPriority } from '@/lib/reminders';
import { createReminder, suggestReminder, transcribeVoice } from '@/app/actions/reminders';

const field =
  'mt-1 w-full rounded-input border border-line bg-white px-4 py-3 outline-none focus:border-violet500';
const label = 'block text-sm font-semibold text-ink600';

type Phase = 'record' | 'recording' | 'working' | 'review';

interface Fields {
  title: string;
  due_date: string;
  due_time: string;
  category: string;
  priority: ReminderPriority;
  relatedRef: string;
  description: string;
}

const EMPTY: Fields = {
  title: '',
  due_date: '',
  due_time: '',
  category: '',
  priority: 'NORMAL',
  relatedRef: '',
  description: '',
};

/**
 * Capture a reminder by voice: record → Whisper transcription → Claude field
 * suggestion → review & confirm. The audio is only sent for transcription and
 * never stored; if the mic or a key is unavailable, the transcript box is
 * editable so the user can type and still get a suggestion.
 */
export function VoiceReminder({
  relatedOptions,
  children,
}: {
  relatedOptions: RelatedOption[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('record');
  const [transcript, setTranscript] = useState('');
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [note, setNote] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const reset = () => {
    setPhase('record');
    setTranscript('');
    setFields(EMPTY);
    setNote(null);
  };
  const close = () => {
    recorderRef.current?.stop();
    setOpen(false);
    reset();
  };

  const applySuggestion = async (text: string) => {
    setPhase('working');
    setNote('Reading your reminder…');
    const r = await suggestReminder(text);
    if (r.ok) {
      const s = r.suggestion;
      setFields({
        title: s.title,
        due_date: s.due_date ?? '',
        due_time: s.due_time ?? '',
        category: s.category ?? '',
        priority: s.priority,
        relatedRef: s.related_ref ?? '',
        description: s.notes ?? '',
      });
      setNote(null);
    } else {
      // Fall back to the raw text as the title so nothing is lost.
      setFields({ ...EMPTY, title: text.trim().slice(0, 120) });
      setNote(r.error);
    }
    setPhase('review');
  };

  const handleBlob = async (blob: Blob) => {
    setPhase('working');
    setNote('Transcribing…');
    const fd = new FormData();
    fd.append('audio', blob, 'reminder.webm');
    const r = await transcribeVoice(fd);
    if (r.ok) {
      setTranscript(r.text);
      await applySuggestion(r.text);
    } else {
      setNote(r.error);
      setPhase('review'); // let them type instead
    }
  };

  const startRecording = async () => {
    setNote(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void handleBlob(new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' }));
      };
      mr.start();
      recorderRef.current = mr;
      setPhase('recording');
    } catch {
      setNote('Microphone unavailable — type your reminder below and I’ll still suggest the details.');
      setPhase('review');
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  };

  const [relType, relId] = fields.relatedRef ? fields.relatedRef.split(':') : ['', ''];

  const save = async () => {
    const fd = new FormData();
    fd.set('title', fields.title);
    fd.set('description', fields.description);
    fd.set('due_date', fields.due_date);
    fd.set('due_time', fields.due_time);
    fd.set('category', fields.category);
    fd.set('priority', fields.priority);
    fd.set('related_entity_type', relType);
    fd.set('related_entity_id', relId);
    if (transcript.trim()) fd.set('transcription', transcript.trim());
    await createReminder(fd);
    close();
  };

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => setFields((f) => ({ ...f, [k]: v }));

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        {children}
      </button>

      <BottomSheet open={open} onClose={close} title="Record a reminder">
        {(phase === 'record' || phase === 'recording') && (
          <div className="py-4 text-center">
            <button
              type="button"
              onClick={phase === 'recording' ? stopRecording : startRecording}
              aria-label={phase === 'recording' ? 'Stop recording' : 'Start recording'}
              className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-white shadow-card ${
                phase === 'recording' ? 'animate-pulse bg-neg' : 'bg-violet500'
              }`}
            >
              <Icon name="microphone" size={36} />
            </button>
            <p className="mt-4 text-sm font-semibold text-ink900">
              {phase === 'recording' ? 'Listening… tap to stop' : 'Tap and say your reminder'}
            </p>
            <p className="mt-1 text-xs text-ink600">
              e.g. “Remind me to cancel Loom before the next charge on August 5.”
            </p>
            {note && <p className="mt-3 text-sm text-neg">{note}</p>}
            <button
              type="button"
              onClick={() => setPhase('review')}
              className="mt-5 text-sm font-bold text-violet600"
            >
              Or type it instead
            </button>
          </div>
        )}

        {phase === 'working' && (
          <div className="py-10 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-line border-t-violet500" />
            <p className="mt-4 text-sm font-semibold text-ink600">{note ?? 'Working…'}</p>
          </div>
        )}

        {phase === 'review' && (
          <div className="grid gap-3">
            <label className={label}>
              What you said <span className="font-normal text-ink600">(edit if needed)</span>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={2}
                placeholder="Type your reminder…"
                className={field}
              />
            </label>
            <button
              type="button"
              onClick={() => transcript.trim() && applySuggestion(transcript)}
              disabled={!transcript.trim()}
              className="justify-self-start rounded-full bg-violet100 px-4 py-1.5 text-sm font-bold text-violet600 disabled:opacity-50"
            >
              ✨ Suggest details
            </button>

            {note && <p className="text-sm text-warn">{note}</p>}

            <div className="mt-1 border-t border-line pt-3">
              <label className={label}>
                Reminder
                <input
                  value={fields.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="Cancel Loom…"
                  className={field}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className={label}>
                Due date
                <input type="date" value={fields.due_date} onChange={(e) => set('due_date', e.target.value)} className={field} />
              </label>
              <label className={label}>
                Time
                <input type="time" value={fields.due_time} onChange={(e) => set('due_time', e.target.value)} className={field} />
              </label>
            </div>

            <label className={label}>
              Category
              <select value={fields.category} onChange={(e) => set('category', e.target.value)} className={field}>
                <option value="">Choose a category…</option>
                {REMINDER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className={label}>
                Priority
                <select
                  value={fields.priority}
                  onChange={(e) => set('priority', e.target.value as ReminderPriority)}
                  className={field}
                >
                  {REMINDER_PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              {relatedOptions.length > 0 && (
                <label className={label}>
                  Linked item
                  <select value={fields.relatedRef} onChange={(e) => set('relatedRef', e.target.value)} className={field}>
                    <option value="">Not linked</option>
                    {relatedOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <label className={label}>
              Notes <span className="font-normal text-ink600">(optional)</span>
              <textarea
                value={fields.description}
                onChange={(e) => set('description', e.target.value)}
                rows={2}
                className={field}
              />
            </label>

            <button
              type="button"
              onClick={save}
              disabled={!fields.title.trim()}
              className="mt-1 w-full rounded-button bg-violet500 px-5 py-4 text-center font-bold text-white shadow-card disabled:opacity-60"
            >
              Save reminder
            </button>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
