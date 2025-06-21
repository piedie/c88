import { BrowserRouter, Route, Routes } from "react-router-dom";
import JuryPage from "./pages/Jury";
import AdminPage from "./pages/Admin";
import StatsPage from "./pages/Stats";
import Home from "./pages/Home";
import "./app.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/jury" element={<JuryPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/stats" element={<StatsPage />} />
      </Routes>
    </BrowserRouter>
  );
}