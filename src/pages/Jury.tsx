import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function JuryPage() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [doublePoints, setDoublePoints] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("teams").select();
      setTeams(data || []);
    }
    const pw = prompt("Wachtwoord?");
    if (pw === "jury2025") load();
  }, []);

  const handleScore = async (team, opdracht, bonus = false) => {
    const { data: existing } = await supabase
      .from("scores")
      .select()
      .eq("team_id", team.id)
      .eq("opdracht", opdracht);
    if (existing.length > 0) return alert("Deze opdracht is al gescoord voor dit team");

    const punten = bonus ? 5 : doublePoints ? 2 : 1;
    await supabase.from("scores").insert({ team_id: team.id, opdracht, punten });
    setSubmitted(true);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Jury 🔑</h2>
      {selectedTeam ? (
        <>
          <h3>Opdrachten voor {selectedTeam.naam}</h3>
          {[...Array(88)].map((_, i) => (
            <button key={i} onClick={() => handleScore(selectedTeam, i + 1)}>{i + 1}</button>
          ))}
          <button onClick={() => handleScore(selectedTeam, 0, true)}>💡 Bonuspunt</button>
        </>
      ) : (
        <>
          <h3>Kies een team</h3>
          {teams.map((team) => (
            <button key={team.id} onClick={() => setSelectedTeam(team)}>{team.naam}</button>
          ))}
        </>
      )}
    </div>
  );
}