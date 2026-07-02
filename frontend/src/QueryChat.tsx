import { useState } from "react";
import { useQueryStream } from "./useQueryStream";
import styles from "./QueryChat.module.css";

function QueryChat() {
  const [question, setQuestion] = useState("");
  const { answer, isStreaming, error, askQuestion } = useQueryStream();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isStreaming) return;
    askQuestion(question);
  };

  return (
    <div className={styles.page}>
      <div className={styles.console}>
        <div className={styles.eyebrow}>
          <span className={styles.statusDot} data-active={isStreaming} />
          knowledge sync engine
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <span className={styles.prompt}>&gt;</span>
          <input
            className={styles.input}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about your documents..."
            disabled={isStreaming}
          />
          <button
            type="submit"
            className={styles.button}
            disabled={isStreaming || !question.trim()}
          >
            {isStreaming ? "streaming" : "ask"}
          </button>
        </form>

        {error && <div className={styles.errorPanel}>error — {error}</div>}

        {answer && (
          <div className={styles.answerPanel}>
            {answer}
            {isStreaming && <span className={styles.cursor} />}
          </div>
        )}
      </div>
    </div>
  );
}

export default QueryChat;