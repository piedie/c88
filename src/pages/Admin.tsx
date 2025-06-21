import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

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

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Teambeheer 👥</h2>
      <input placeholder="Teamnaam" value={naam} onChange={(e) => setNaam(e.target.value)} />
      <select value={categorie} onChange={(e) => setCategorie(e.target.value)}>
        <option value="MR">MR</option>
        <option value="AVFV">AVFV</option>
        <option value="JEM">JEM</option>
      </select>
      <button onClick={addTeam}>➕ Toevoegen</button>
      <ul>
        {teams.map((team) => (
          <li key={team.id}>{team.naam} ({team.categorie})</li>
        ))}
      </ul>
    </div>
  );
}