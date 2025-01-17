import { BrowserRouter as Router } from "react-router-dom";
import Index from "./pages/Index";
import Meeting from "./pages/Meeting";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./contexts/AuthContext";
import { Routes, Route } from "react-router-dom";

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/meeting/:connectionId" element={<Meeting />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </Router>
  );
}

export default App;