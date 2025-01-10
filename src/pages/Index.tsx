import { useState, useEffect } from "react";
import { SkillCard } from "@/components/SkillCard";
import { SkillForm } from "@/components/SkillForm";
import { Button } from "@/components/ui/button";
import { PlusIcon, SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Skill {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  instructor_id: string;
}

const ITEMS_PER_PAGE = 6;

const Index = () => {
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchSkills();
    }
  }, [user]);

  const fetchSkills = async () => {
    try {
      const { data, error } = await supabase
        .from('skills')
        .select('*');
      
      if (error) throw error;
      setSkills(data || []);
    } catch (error: any) {
      console.error('Error fetching skills:', error);
      toast({
        title: "Error",
        description: "Failed to load skills",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (skill: Skill) => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to connect with instructors.",
      });
      return;
    }

    if (skill.instructor_id === user.id) {
      toast({
        title: "Cannot connect",
        description: "You cannot connect to your own skill listing.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('skill_connections')
        .insert({
          skill_id: skill.id,
          learner_id: user.id,
        });

      if (error) throw error;

      toast({
        title: "Request Sent!",
        description: "Your connection request has been sent to the instructor.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredSkills = skills.filter(skill =>
    skill.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const paginatedSkills = filteredSkills.slice(0, ITEMS_PER_PAGE);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <AuthForm />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h1 
              onClick={() => navigate('/')} 
              className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-gray-700 transition-colors"
            >
              Skill Exchange
            </h1>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search skills..."
                  className="pl-9 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Add Skill
              </Button>
              <Button
                variant="outline"
                onClick={() => signOut()}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showForm && (
          <div className="mb-8 bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Add Your Skill</h2>
            <SkillForm />
          </div>
        )}

        {loading ? (
          <div className="text-center py-10">
            <p className="text-gray-500">Loading skills...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedSkills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onConnect={() => handleConnect(skill)}
                />
              ))}
            </div>

            {filteredSkills.length === 0 && (
              <div className="text-center py-10">
                <p className="text-gray-500">No skills found matching your search.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
