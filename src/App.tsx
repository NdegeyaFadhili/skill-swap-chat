import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Meeting from "./pages/Meeting";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./contexts/AuthContext";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/meeting/:connectionId" element={<Meeting />} />
        </Routes>
        <Toaster />
      </Router>
    </AuthProvider>
  );
}

export default App;