import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const App = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      const { data, error } = await supabase.from('teams').select('*');
      if (error) {
        console.error('Fout bij ophalen teams:', error.message);
      } else {
        setTeams(data || []);
      }
      setLoading(false);
    };

    fetchTeams();
  }, []);

  return (
    <div>
      <h1>Crazy 88 Spel</h1>
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
