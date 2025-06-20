import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const App = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState('');
  const [category, setCategory] = useState('AVFV');

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    const { data, error } = await supabase.from('teams').select('*');
    if (error) {
      console.error('Fout bij ophalen teams:', error.message);
    } else {
      setTeams(data || []);
    }
    setLoading(false);
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName) return;

    const { error } = await supabase.from('teams').insert([{ name: teamName, category }]);
    if (error) {
      console.error('Fout bij toevoegen team:', error.message);
    } else {
      setTeamName('');
      await fetchTeams();
    }
  };

  return (
    <div>
      <h1>Crazy 88 Spel</h1>

      <form onSubmit={handleAddTeam}>
        <h2>Nieuw team toevoegen</h2>
        <input
          type="text"
          placeholder="Teamnaam"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="AVFV">AVFV</option>
          <option value="MR">MR</option>
          <option value="JEM">JEM</option>
        </select>
        <button type="submit">Team toevoegen</button>
      </form>

      <h2>Teams</h2>
      {loading ? (
        <p>Teams laden...</p>
      ) : (
        <ul>
          {teams.map((team) => (
            <li key={team.id}>
              {team.name} ({team.category})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default App;
