import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function StatsPage() {
  const [stats, setStats] = useState([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("scores").select();
      setStats(data || []);
    }
    load();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Statistieken 📊</h2>
      <p>⚠️ Placeholder: hier komen grafieken, creatiefste opdracht, gemiddelde tijd, enz.</p>
      <pre>{JSON.stringify(stats, null, 2)}</pre>
    </div>
  );
}