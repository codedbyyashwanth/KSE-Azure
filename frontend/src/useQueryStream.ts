import { useRef, useState, useCallback } from "react";

const API_URL = "https://kse-functions-yp.azurewebsites.net/api/query";

interface StreamTokenEvent {
  token: string;
}

interface StreamErrorEvent {
  error: string;
}

type StreamEvent = StreamTokenEvent | StreamErrorEvent;

interface UseQueryStreamResult {
  answer: string;
  isStreaming: boolean;
  error: string | null;
  askQuestion: (question: string) => Promise<void>;
  cancel: () => void;
}

function isErrorEvent(event: StreamEvent): event is StreamErrorEvent {
  return "error" in event;
}

export function useQueryStream(): UseQueryStreamResult {
  const [answer, setAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const askQuestion = useCallback(async (question: string) => {
    // Cancel any in-flight request before starting a new one
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setAnswer("");
    setError(null);
    setIsStreaming(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? ""; // keep the last, possibly incomplete event

        for (const rawEvent of events) {
          if (!rawEvent.startsWith("data: ")) continue;
          const data = rawEvent.slice(6);

          if (data === "[DONE]") continue;

          const parsed: StreamEvent = JSON.parse(data);

          if (isErrorEvent(parsed)) {
            setError(parsed.error);
          } else {
            setAnswer((prev) => prev + parsed.token);
          }
        }
      }
    } catch (err) {
      // Aborting is expected behavior (new question or unmount), not a real error
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsStreaming(false);
    }
  }, []);

  return { answer, isStreaming, error, askQuestion, cancel };
}