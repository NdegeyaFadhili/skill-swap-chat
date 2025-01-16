import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Video, PhoneCall } from "lucide-react";
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
  const [searchParams] = useSearchParams();
  const meetingType = searchParams.get('type') || 'chat';
  const [connection, setConnection] = useState<Connection | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!connectionId || !user) return;
    
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

      if (error || !data) {
        console.error('Error fetching connection:', error);
        toast({
          title: "Error",
          description: "Unable to load meeting details",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      // Verify that the current user is either the learner or the instructor
      if (data.learner_id !== user.id && data.skill.instructor_id !== user.id) {
        toast({
          title: "Unauthorized",
          description: "You don't have access to this meeting",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setConnection(data);
    };

    // Subscribe to connection updates
    const channel = supabase.channel(`meeting:${connectionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'skill_connections',
          filter: `id=eq.${connectionId}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updatedConnection = payload.new as any;
            if (updatedConnection.status !== 'accepted') {
              toast({
                title: "Meeting Ended",
                description: "This meeting has been ended",
              });
              navigate('/');
            }
          }
        }
      )
      .subscribe();

    fetchConnection();

    return () => {
      channel.unsubscribe();
    };
  }, [connectionId, user, navigate, toast]);

  const getMeetingIcon = () => {
    switch (meetingType) {
      case 'chat':
        return <MessageSquare className="h-6 w-6" />;
      case 'video':
        return <Video className="h-6 w-6" />;
      case 'audio':
        return <PhoneCall className="h-6 w-6" />;
      default:
        return <MessageSquare className="h-6 w-6" />;
    }
  };

  const getMeetingTitle = () => {
    switch (meetingType) {
      case 'chat':
        return 'Chat Session';
      case 'video':
        return 'Video Call';
      case 'audio':
        return 'Audio Call';
      default:
        return 'Meeting';
    }
  };

  if (!connection) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading meeting...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            {getMeetingIcon()}
            <CardTitle className="text-2xl">
              {connection.skill.title} - {getMeetingTitle()}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <h3 className="font-semibold mb-2">About this skill:</h3>
            <p className="text-gray-600">{connection.skill.description}</p>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-center">
              {meetingType === 'chat' && (
                <div className="w-full max-w-2xl bg-gray-50 rounded-lg p-4">
                  <p className="text-center text-gray-500">Chat interface will be implemented here</p>
                </div>
              )}
              {meetingType === 'video' && (
                <div className="w-full max-w-2xl bg-gray-50 rounded-lg p-4 aspect-video">
                  <p className="text-center text-gray-500">Video interface will be implemented here</p>
                </div>
              )}
              {meetingType === 'audio' && (
                <div className="w-full max-w-2xl bg-gray-50 rounded-lg p-4">
                  <p className="text-center text-gray-500">Audio interface will be implemented here</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}