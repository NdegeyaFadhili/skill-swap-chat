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
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

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

// Type for the real-time payload with proper type guards
interface SkillConnectionPayload {
  id: string;
  skill_id: string;
  learner_id: string;
  status: string;
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
      
      // Subscribe to skills changes
      const skillsChannel = supabase
        .channel('skills-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'skills'
          },
          (payload: RealtimePostgresChangesPayload<Skill>) => {
            console.log('Skills change received:', payload);
            if (payload.eventType === 'INSERT') {
              setSkills(currentSkills => [...currentSkills, payload.new]);
            } else if (payload.eventType === 'DELETE') {
              setSkills(currentSkills => 
                currentSkills.filter(skill => skill.id !== payload.old.id)
              );
            } else if (payload.eventType === 'UPDATE') {
              setSkills(currentSkills =>
                currentSkills.map(skill =>
                  skill.id === payload.new.id ? { ...skill, ...payload.new } : skill
                )
              );
            }
          }
        )
        .subscribe();

      // Subscribe to connection requests changes
      const connectionsChannel = supabase
        .channel('connection-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'skill_connections'
          },
          async (payload: RealtimePostgresChangesPayload<SkillConnectionPayload>) => {
            console.log('Connection change received:', payload);
            
            // Type guard to ensure payload.new exists and has the required properties
            if (!payload.new || !('skill_id' in payload.new)) return;
            
            const newPayload = payload.new as SkillConnectionPayload;
            
            // Fetch the associated skill for the connection
            const { data: skillData } = await supabase
              .from('skills')
              .select('*')
              .eq('id', newPayload.skill_id)
              .single();

            if (skillData?.instructor_id === user.id) {
              // This is a connection request for a skill where the current user is the instructor
              if (payload.eventType === 'INSERT') {
                const newRequest: ConnectionRequest = {
                  id: newPayload.id,
                  skill_id: newPayload.skill_id,
                  learner_id: newPayload.learner_id,
                  status: newPayload.status,
                  skill: skillData
                };
                setConnectionRequests(current => [...current, newRequest]);
                
                toast({
                  title: "New Connection Request",
                  description: `Someone wants to learn ${skillData.title}!`,
                });
              } else if (payload.eventType === 'UPDATE' && newPayload.status === 'accepted') {
                // Remove the request from the list and navigate to meeting
                setConnectionRequests(current =>
                  current.filter(req => req.id !== newPayload.id)
                );
                navigate(`/meeting/${newPayload.id}?type=video`);
                toast({
                  title: "Meeting Started",
                  description: "You've joined the meeting room.",
                });
              }
            } else if (newPayload.learner_id === user.id) {
              // This is a connection request where the current user is the learner
              if (payload.eventType === 'UPDATE') {
                if (newPayload.status === 'accepted') {
                  navigate(`/meeting/${newPayload.id}?type=video`);
                  toast({
                    title: "Request Accepted!",
                    description: "You've joined the meeting room.",
                  });
                } else if (newPayload.status === 'rejected') {
                  toast({
                    title: "Request Rejected",
                    description: "Your connection request has been rejected.",
                  });
                }
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(skillsChannel);
        supabase.removeChannel(connectionsChannel);
      };
    }
  }, [user, navigate, toast]);

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
        .eq('status', 'pending');

      if (error) throw error;
      
      // Filter requests to only show those for skills where the current user is the instructor
      const validRequests = (data || []).filter(request => 
        request.skill && request.skill.instructor_id === user.id
      );
      
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
      const { error } = await supabase
        .from('skill_connections')
        .update({ 
          status: accept ? 'accepted' : 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', connectionId);

      if (error) throw error;

      // Remove the request from the list
      setConnectionRequests(prev => 
        prev.filter(request => request.id !== connectionId)
      );

      if (accept) {
        // Immediately navigate to the meeting page after accepting
        navigate(`/meeting/${connectionId}?type=video`);
      }

      toast({
        title: accept ? "Request Accepted" : "Request Rejected",
        description: accept 
          ? "Joining meeting room..." 
          : "You have rejected the connection request",
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
            <SkillForm onSuccess={() => setShowForm(false)} />
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
                  onDelete={() => {
                    // No need to fetch skills as we're using real-time updates
                    console.log('Skill deleted');
                  }}
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