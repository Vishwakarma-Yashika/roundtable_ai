"use client";

import { useEffect, useRef, useState } from "react";

/* Minimal typings for the Web Speech API, which TypeScript's DOM lib omits. */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechInputError = "unsupported" | "denied" | "failed";

/** Detaches every handler, then aborts: nothing from this session fires again. */
function discard(recognition: SpeechRecognitionLike) {
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
  recognition.abort();
}

/**
 * Browser-native speech-to-text, isolated behind a small interface so the
 * composer doesn't depend on the Web Speech API. Streams the live transcript
 * to `onTranscript` while listening. Real voice infrastructure replaces this
 * later.
 *
 * - `stop()` ends gracefully and keeps the final result.
 * - `cancel()` ends immediately and discards anything still in flight
 *   (use it after sending, so late results can't refill the input).
 */
export function useSpeechInput(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<SpeechInputError | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Release the microphone if the composer unmounts mid-dictation.
  useEffect(
    () => () => {
      if (recognitionRef.current) discard(recognitionRef.current);
      recognitionRef.current = null;
    },
    []
  );

  const stop = () => {
    recognitionRef.current?.stop();
  };

  const cancel = () => {
    if (!recognitionRef.current) return;
    discard(recognitionRef.current);
    recognitionRef.current = null;
    setListening(false);
  };

  const start = () => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setError("unsupported");
      return;
    }

    // Never run two sessions at once.
    if (recognitionRef.current) discard(recognitionRef.current);

    setError(null);
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    // Events from a session that has since been replaced are ignored.
    const isCurrent = () => recognitionRef.current === recognition;

    recognition.onresult = (event) => {
      if (!isCurrent()) return;
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0]?.transcript ?? "";
      }
      onTranscriptRef.current(transcript.trim());
    };
    recognition.onerror = (event) => {
      if (!isCurrent() || event.error === "aborted" || event.error === "no-speech") return;
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "denied"
          : "failed"
      );
    };
    recognition.onend = () => {
      if (!isCurrent()) return;
      recognitionRef.current = null;
      setListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setError("failed");
    }
  };

  const toggle = () => (listening ? stop() : start());
  const clearError = () => setError(null);

  return { listening, error, toggle, cancel, clearError };
}
