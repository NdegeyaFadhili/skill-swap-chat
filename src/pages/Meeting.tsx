import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Video, PhoneCall } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Skill {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  instructor_id: string;
}

interface Connection {
  id: string;
  skill_id: string;
  learner_id: string;
  status: string;
  skill: Skill;
}

export default function Meeting() {
  const { connectionId } = useParams();
  const [connection, setConnection] = useState<Connection | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!connectionId) return;
    
    const fetchConnection = async () => {
      const { data, error } = await supabase
        .from('skill_connections')
        .select(`
          *,
          skill:skills(*)
        `)
        .eq('id', connectionId)
        .eq('status', 'accepted')
        .single();

      if (error) {
        console.error('Error fetching connection:', error);
        toast({
          title: "Error",
          description: "Unable to load meeting details",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      if (!data) {
        toast({
          title: "Not Found",
          description: "This meeting is not available",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setConnection(data);
    };

    fetchConnection();
  }, [connectionId, navigate, toast]);

  if (!connection) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading meeting...</p>
      </div>
    );
  }

  const isInstructor = user?.id === connection.skill.instructor_id;

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">
            {connection.skill.title} - Learning Session
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <h3 className="font-semibold mb-2">About this skill:</h3>
            <p className="text-gray-600">{connection.skill.description}</p>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-center gap-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="lg" className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Start Chat
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Start a chat session</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="lg" variant="outline" className="flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      Video Call
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Start a video call</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="lg" variant="outline" className="flex items-center gap-2">
                      <PhoneCall className="h-5 w-5" />
                      Audio Call
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Start an audio call</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}