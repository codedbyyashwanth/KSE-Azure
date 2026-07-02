import { useRef, useState } from "react";
import { useFileUpload } from "./useFileUpload";
import styles from "./UploadPanel.module.css";

const ACCEPTED_TYPES = ".pdf,.docx,.txt";

function UploadPanel() {
  const { status, progress, error, uploadFile, reset } = useFileUpload();
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleReset = () => {
    reset();
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isBusy = status === "uploading" || status === "indexing";
  const isDone = status === "success" || status === "error" || status === "timeout";

  return (
    <div className={styles.console}>
      <div className={styles.eyebrow}>
        <span className={styles.statusDot} data-active={isBusy} />
        upload document
      </div>

      <div
        className={styles.dropzone}
        data-dragging={isDragging}
        data-status={status}
        onClick={() => !isBusy && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleChange}
          disabled={isBusy}
          className={styles.hiddenInput}
        />

        {status === "idle" && (
          <>
            <span className={styles.prompt}>&gt;</span>
            <span>drop a file or click to browse (.pdf, .docx, .txt)</span>
          </>
        )}

        {status === "uploading" && (
          <div className={styles.progressWrap}>
            <span>{fileName} — {progress}%</span>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {status === "indexing" && (
          <span className={styles.indexing}>indexing {fileName}…</span>
        )}

        {status === "success" && (
          <span className={styles.success}>✓ {fileName} indexed and searchable</span>
        )}

        {status === "timeout" && (
          <span className={styles.errorText}>
            still indexing {fileName} — check back shortly, this can take longer for large files
          </span>
        )}

        {status === "error" && (
          <span className={styles.errorText}>✕ {error}</span>
        )}
      </div>

      {isDone && (
        <button className={styles.resetButton} onClick={handleReset}>
          upload another
        </button>
      )}
    </div>
  );
}

export default UploadPanel;