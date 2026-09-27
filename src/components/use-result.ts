"use client";

import { useEffect, useState } from "react";
import type { Response } from "@/lib/types";

/**
 * Responses for a finished attempt: the learner's own if they took it in this
 * browser, otherwise the sample. Stands in for `GET /api/attempts/:id`.
 */
export function useAttemptResponses(attemptId: string, fallback: Response[]) {
  const [responses, setResponses] = useState<Response[] | null>(null);
  const [own, setOwn] = useState(false);
  useEffect(() => {
    let list: Response[] | null = null;
    try {
      const raw = localStorage.getItem(`lm-result-${attemptId}`);
      list = raw ? (JSON.parse(raw) as Response[]) : null;
    } catch {}
    /* eslint-disable react-hooks/set-state-in-effect -- reading browser storage after mount */
    setOwn(!!list);
    setResponses(list ?? fallback);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [attemptId, fallback]);
  return { responses, own };
}
