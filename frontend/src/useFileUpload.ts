import { useState, useCallback, useRef, useEffect } from "react";
import { BlockBlobClient } from "@azure/storage-blob";
import * as signalR from "@microsoft/signalr";

const API_BASE = import.meta.env.VITE_API_BASE_URL; // e.g. ".../api" — no /negotiate suffix
const SAS_URL = `${API_BASE}/upload-sas`;

const FALLBACK_TIMEOUT_MS = 60000; // safety net if the SignalR message never arrives

type UploadStatus = "idle" | "uploading" | "indexing" | "success" | "error" | "timeout";

interface UseFileUploadResult {
  status: UploadStatus;
  progress: number;
  error: string | null;
  uploadFile: (file: File) => Promise<void>;
  reset: () => void;
}

interface DocEventPayload {
  docName: string;
  error?: string;
  chunkCount?: number;
}

export function useFileUpload(): UseFileUploadResult {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const pendingDocNameRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // one connection for the lifetime of the component, reused across uploads
  const getConnection = useCallback(async () => {
    if (connectionRef.current) return connectionRef.current;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(API_BASE, { withCredentials: false })
      .withAutomaticReconnect()
      .build();

    connection.on("docIndexed", (payload: DocEventPayload) => {
      if (payload.docName !== pendingDocNameRef.current) return; // event for a different upload
      clearPendingTimeout();
      pendingDocNameRef.current = null;
      setStatus("success");
    });

    connection.on("docFailed", (payload: DocEventPayload) => {
      if (payload.docName !== pendingDocNameRef.current) return;
      clearPendingTimeout();
      pendingDocNameRef.current = null;
      setError(payload.error ?? "Indexing failed");
      setStatus("error");
    });

    await connection.start();
    connectionRef.current = connection;
    return connection;
  }, [clearPendingTimeout]);

  const reset = useCallback(() => {
    clearPendingTimeout();
    pendingDocNameRef.current = null;
    setStatus("idle");
    setProgress(0);
    setError(null);
  }, [clearPendingTimeout]);

  const uploadFile = useCallback(async (file: File) => {
  setStatus("uploading");
  setProgress(0);
  setError(null);

  try {
    // establish the SignalR connection FIRST, in parallel with getting the SAS URL
    const [connection, sasRes] = await Promise.all([
      getConnection(),
      fetch(SAS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      }),
    ]);

    if (!sasRes.ok) throw new Error(`Failed to get upload URL (${sasRes.status})`);
    const { uploadUrl, blobName } = await sasRes.json();

    pendingDocNameRef.current = blobName; // listening BEFORE the blob even starts uploading

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

    timeoutRef.current = setTimeout(() => {
      if (pendingDocNameRef.current === blobName) {
        pendingDocNameRef.current = null;
        setStatus("timeout");
      }
    }, FALLBACK_TIMEOUT_MS);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Upload failed");
    setStatus("error");
  }
}, [getConnection]);

  useEffect(() => {
    return () => {
      clearPendingTimeout();
      connectionRef.current?.stop();
    };
  }, [clearPendingTimeout]);

  return { status, progress, error, uploadFile, reset };
}