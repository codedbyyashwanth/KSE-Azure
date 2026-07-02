import UploadPanel from './UploadPanel';
import QueryChat from './QueryChat';
import styles from './App.module.css';

function App() {
  return (
    <div className={styles.page}>
      <UploadPanel />
      <QueryChat />
    </div>
  )
}

export default App