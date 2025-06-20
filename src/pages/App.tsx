import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import './App.css';

const App = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<number | null>(null);
  const [doublePoints, setDoublePoints] = useState(false);

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
  };

  const handleAssignmentClick = (num: number) => {
    setSelectedAssignment(num);
  };

  const handleTeamClick = async (teamId: string) => {
    if (!selectedAssignment) return;
    const finalPoints = doublePoints ? 2 : 1;
    await supabase.from('scores').insert([
      {
        team_id: teamId,
        assignment_id: selectedAssignment,
        points: finalPoints,
      },
    ]);
    setSelectedAssignment(null);
    fetchData();
  };

  const toggleDoublePoints = async () => {
    const { error } = await supabase
      .from('config')
      .update({ double_points_active: !doublePoints })
      .eq('id', 1);
    if (!error) setDoublePoints(!doublePoints);
  };

  const teamByCategory = (category: string) =>
    teams.filter((t) => t.category === category);

  return (
    <div className="app">
      <h1>🎲 Crazy 88 Invoer</h1>

      <button className={`toggle ${doublePoints ? 'active' : ''}`} onClick={toggleDoublePoints}>
        🔁 Dubbele punten {doublePoints ? 'AAN' : 'UIT'}
      </button>

      {!selectedAssignment ? (
        <>
          <h2>📋 Kies opdracht</h2>
          <div className="grid">
            {Array.from({ length: 88 }, (_, i) => (
              <button key={i + 1} onClick={() => handleAssignmentClick(i + 1)}>
                #{i + 1}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <h2>🧑‍🤝‍🧑 Kies team voor opdracht #{selectedAssignment}</h2>
          {['AVFV', 'MR', 'JEM'].map((cat) => (
            <div key={cat}>
              <h3>{cat}</h3>
              <div className="team-grid">
                {teamByCategory(cat).map((team) => (
                  <button key={team.id} onClick={() => handleTeamClick(team.id)}>
                    ⭐ {team.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button className="cancel" onClick={() => setSelectedAssignment(null)}>← Terug</button>
        </>
      )}
    </div>
  );
};

export default App;
