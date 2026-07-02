import { useState, useCallback, useRef } from "react";
import { BlockBlobClient } from "@azure/storage-blob";

const SAS_URL = "https://kse-functions-yp.azurewebsites.net/api/upload-sas";
const CHECK_INDEXED_URL = "https://kse-functions-yp.azurewebsites.net/api/check-indexed";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 20; // ~60s total before giving up

type UploadStatus = "idle" | "uploading" | "indexing" | "success" | "error" | "timeout";

interface UseFileUploadResult {
  status: UploadStatus;
  progress: number;
  error: string | null;
  uploadFile: (file: File) => Promise<void>;
  reset: () => void;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useFileUpload(): UseFileUploadResult {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setStatus("idle");
    setProgress(0);
    setError(null);
  }, []);

  const pollForIndex = useCallback(async (docName: string) => {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await delay(POLL_INTERVAL_MS);
      if (cancelledRef.current) return; // user reset/left before finishing

      try {
        const res = await fetch(
          `${CHECK_INDEXED_URL}?doc_name=${encodeURIComponent(docName)}`
        );
        const { indexed } = await res.json();
        if (indexed) {
          setStatus("success");
          return;
        }
      } catch {
        // transient network hiccup — keep trying rather than failing the whole flow
      }
    }
    setStatus("timeout");
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    cancelledRef.current = false;
    setStatus("uploading");
    setProgress(0);
    setError(null);

    try {
      const sasRes = await fetch(SAS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      if (!sasRes.ok) throw new Error(`Failed to get upload URL (${sasRes.status})`);
      const { uploadUrl, blobName } = await sasRes.json();

      const blockBlobClient = new BlockBlobClient(uploadUrl);
      await blockBlobClient.uploadData(file, {
        blobHTTPHeaders: { blobContentType: file.type },
        onProgress: (ev) => {
          if (file.size > 0) {
            setProgress(Math.round((ev.loadedBytes / file.size) * 100));
          }
        },
      });

      setStatus("indexing");
      await pollForIndex(blobName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus("error");
    }
  }, [pollForIndex]);

  return { status, progress, error, uploadFile, reset };
}