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

interface ConnectionRequest {
  id: string;
  skill_id: string;
  learner_id: string;
  status: string;
  skill: Skill | null;
}

const ITEMS_PER_PAGE = 6;

const Index = () => {
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchSkills();
      fetchConnectionRequests();
      
      const skillsSubscription = supabase
        .channel('skills-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'skills'
          },
          () => {
            fetchSkills();
          }
        )
        .subscribe();
      
      const connectionSubscription = supabase
        .channel('connection-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'skill_connections'
          },
          (payload) => {
            if (payload.eventType === 'UPDATE') {
              const updatedConnection = payload.new as any;
              if (updatedConnection.status === 'accepted') {
                if (updatedConnection.learner_id === user.id) {
                  navigate(`/meeting/${updatedConnection.id}`);
                } else {
                  supabase
                    .from('skills')
                    .select('instructor_id')
                    .eq('id', updatedConnection.skill_id)
                    .single()
                    .then(({ data }) => {
                      if (data?.instructor_id === user.id) {
                        navigate(`/meeting/${updatedConnection.id}`);
                      }
                    });
                }
              } else if (updatedConnection.status === 'rejected') {
                fetchConnectionRequests();
                toast({
                  title: "Request Rejected",
                  description: "The connection request has been rejected.",
                });
              }
            } else if (payload.eventType === 'DELETE') {
              fetchConnectionRequests();
            }
          }
        )
        .subscribe();

      return () => {
        skillsSubscription.unsubscribe();
        connectionSubscription.unsubscribe();
      };
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

  const fetchConnectionRequests = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('skill_connections')
        .select(`
          *,
          skill:skills(*)
        `)
        .eq('status', 'pending')
        .filter('skill.instructor_id', 'eq', user.id);

      if (error) throw error;
      
      // Filter out any requests where the skill data is null
      const validRequests = (data || []).filter(request => request.skill !== null);
      setConnectionRequests(validRequests);
    } catch (error: any) {
      console.error('Error fetching connection requests:', error);
      toast({
        title: "Error",
        description: "Failed to load connection requests",
        variant: "destructive",
      });
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

  const handleConnectionResponse = async (connectionId: string, accept: boolean) => {
    try {
      if (accept) {
        const { error } = await supabase
          .from('skill_connections')
          .update({ status: 'accepted' })
          .eq('id', connectionId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('skill_connections')
          .update({ status: 'rejected' })
          .eq('id', connectionId);

        if (error) throw error;

        setConnectionRequests(prev => 
          prev.filter(request => request.id !== connectionId)
        );

        toast({
          title: "Request Rejected",
          description: "You have rejected the connection request",
        });
      }
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
                onClick={() => supabase.auth.signOut()}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {connectionRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Connection Requests</h2>
            <div className="space-y-4">
              {connectionRequests.map((request) => (
                request.skill && (
                  <div key={request.id} className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between">
                    <div>
                      <p className="font-medium">Request for: {request.skill.title}</p>
                      <p className="text-sm text-gray-500">Level: {request.skill.level}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        onClick={() => handleConnectionResponse(request.id, true)}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleConnectionResponse(request.id, false)}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

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
                  onDelete={() => fetchSkills()}
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