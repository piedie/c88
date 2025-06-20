import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const App = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [teamId, setTeamId] = useState('');
  const [assignment, setAssignment] = useState('');
  const [points, setPoints] = useState(1);
  const [doublePoints, setDoublePoints] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: teamData } = await supabase.from('teams').select('*');
    const { data: scoreData } = await supabase.from('scores').select('*');
    const { data: config } = await supabase.from('config').select('*').single();
    setTeams(teamData || []);
    setScores(scoreData || []);
    setDoublePoints(config?.double_points_active || false);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId || !assignment) return;
    const finalPoints = doublePoints ? points * 2 : points;
    const { error } = await supabase.from('scores').insert([
      { team_id: teamId, assignment_id: Number(assignment), points: finalPoints },
    ]);
    if (!error) {
      setAssignment('');
      setPoints(1);
      fetchData();
    }
  };

  const toggleDoublePoints = async () => {
    const { error } = await supabase
      .from('config')
      .update({ double_points_active: !doublePoints })
      .eq('id', 1);
    if (!error) setDoublePoints(!doublePoints);
  };

  const teamPoints = teams.map((team) => {
    const total = scores
      .filter((s) => s.team_id === team.id)
      .reduce((sum, s) => sum + s.points, 0);
    return { ...team, total };
  });

  const bestCategory = () => {
    const catTotals: any = {};
    teams.forEach((t) => {
      const total = scores
        .filter((s) => s.team_id === t.id)
        .reduce((sum, s) => sum + s.points, 0);
      catTotals[t.category] = (catTotals[t.category] || 0) + total;
    });
    const best = Object.entries(catTotals).sort((a: any, b: any) => b[1] - a[1])[0];
    return best ? `${best[0]} (${best[1]} punten)` : 'n.v.t.';
  };

  const mostPopularAssignment = () => {
    const counter: Record<number, number> = {};
    scores.forEach((s) => {
      counter[s.assignment_id] = (counter[s.assignment_id] || 0) + 1;
    });
    const sorted = Object.entries(counter).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? `#${sorted[0][0]} (${sorted[0][1]} keer)` : 'n.v.t.';
  };

  return (
    <div>
      <h1>Crazy 88 Jury-paneel</h1>
      <form onSubmit={handleSubmit}>
        <h2>Voer behaalde opdracht in</h2>
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          <option value="">-- Kies team --</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.category})
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Opdrachtnummer (1–88)"
          value={assignment}
          onChange={(e) => setAssignment(e.target.value)}
          min="1"
          max="88"
        />
        <input
          type="number"
          placeholder="Punten"
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          min="1"
        />
        <button type="submit">Punten toevoegen</button>
      </form>

      <h3>Dubbele punten</h3>
      <button onClick={toggleDoublePoints}>
        {doublePoints ? 'Dubbele punten: AAN' : 'Dubbele punten: UIT'}
      </button>

      <h2>Scorebord</h2>
      <ul>
        {teamPoints
          .sort((a, b) => b.total - a.total)
          .map((t) => (
            <li key={t.id}>
              {t.name} ({t.category}): {t.total} punten
            </li>
          ))}
      </ul>

      <h2>Statistieken</h2>
      <p><strong>Beste categorie:</strong> {bestCategory()}</p>
      <p><strong>Populairste opdracht:</strong> {mostPopularAssignment()}</p>
      <p><strong>Totaal aantal scores:</strong> {scores.length}</p>
    </div>
  );
};

export default App;
