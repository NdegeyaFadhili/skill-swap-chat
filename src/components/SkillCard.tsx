import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Video, PhoneCall, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

interface SkillCardProps {
  skill: {
    id: string;
    title: string;
    description: string;
    category: string;
    level: string;
    instructor_id: string;
  };
  onConnect: () => void;
  onDelete?: () => void;
}

export const SkillCard = ({ skill, onConnect, onDelete }: SkillCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Listen for connection status changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('connection-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'skill_connections',
          filter: `skill_id=eq.${skill.id}`,
        },
        async (payload: any) => {
          if (payload.new.status === 'accepted' && payload.new.learner_id === user.id) {
            navigate(`/meeting/${payload.new.id}?type=video`);
            toast({
              title: "Connection Accepted!",
              description: "Joining the meeting room...",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, skill.id, navigate, toast]);

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-blue-100 text-blue-800';
      case 'advanced':
        return 'bg-purple-100 text-purple-800';
      case 'expert':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isInstructor = user?.id === skill.instructor_id;

  const handleDelete = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('skills')
        .delete()
        .eq('id', skill.id)
        .eq('instructor_id', user.id);

      if (error) throw error;

      toast({
        title: "Skill Deleted",
        description: "Your skill has been successfully deleted.",
      });

      if (onDelete) onDelete();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMeetingTypeSelect = async (type: 'chat' | 'video' | 'audio') => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to start a meeting.",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('skill_connections')
        .select('id, status')
        .eq('skill_id', skill.id)
        .eq('learner_id', user.id)
        .eq('status', 'accepted')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        navigate(`/meeting/${data.id}?type=${type}`);
      } else {
        toast({
          title: "Connection Required",
          description: "Please connect with the instructor first.",
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

  return (
    <Card className="w-full max-w-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-bold">{skill.title}</CardTitle>
            <CardDescription className="mt-1 capitalize">{skill.category}</CardDescription>
          </div>
          <Badge className={`${getLevelColor(skill.level)} capitalize`}>
            {skill.level}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600 mb-4">{skill.description}</p>
        <div className="space-y-3">
          <div className="flex justify-between gap-2">
            {isInstructor ? (
              <>
                <Button 
                  variant="outline" 
                  className="w-full"
                  disabled={true}
                >
                  Your Skill
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="icon"
                        onClick={handleDelete}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Delete Skill</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            ) : (
              <Button 
                onClick={onConnect} 
                className="w-full bg-primary hover:bg-primary/90"
              >
                Connect & Learn
              </Button>
            )}
          </div>
          <div className="flex justify-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleMeetingTypeSelect('chat')}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Chat</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleMeetingTypeSelect('video')}
                  >
                    <Video className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Video Call</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleMeetingTypeSelect('audio')}
                  >
                    <PhoneCall className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Audio Call</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};