import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Link } from "react-router-dom";

export default function AdminPage() {
  const [teams, setTeams] = useState([]);
  const [naam, setNaam] = useState("");
  const [categorie, setCategorie] = useState("MR");

  async function load() {
    const { data } = await supabase.from("teams").select();
    setTeams(data || []);
  }

  async function addTeam() {
    await supabase.from("teams").insert({ naam, categorie });
    setNaam("");
    load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>🛠️ Teambeheer</h2>
      <input
        placeholder="Teamnaam"
        value={naam}
        onChange={(e) => setNaam(e.target.value)}
      />
      <select value={categorie} onChange={(e) => setCategorie(e.target.value)}>
        <option value="AVFV">AVFV</option>
        <option value="MR">MR</option>
        <option value="JEM">JEM</option>
      </select>
      <button onClick={addTeam}>➕ Toevoegen</button>

      <h3>Bestaande teams</h3>
      <ul>
        {teams.map((t: any) => (
          <li key={t.id}>{t.naam} ({t.categorie})</li>
        ))}
      </ul>

      <Link to="/">
        <button>⬅️ Terug naar start</button>
      </Link>
    </div>
  );
}
