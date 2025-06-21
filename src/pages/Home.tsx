import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Welkom bij Crazy 88 🎉</h1>
      <p>Kies een onderdeel:</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "20px" }}>
        <Link to="/jury">
          <button>👩‍⚖️ Jury Invoerscherm</button>
        </Link>
        <Link to="/admin">
          <button>🛠️ Beheer Teams (Admin)</button>
        </Link>
        <Link to="/stats">
          <button>📊 Statistieken & Timer</button>
        </Link>
      </div>
    </div>
  );
}
