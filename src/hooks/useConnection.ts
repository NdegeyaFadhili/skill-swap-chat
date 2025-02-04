
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Connection {
  id: string;
  skill_id: string;
  learner_id: string;
  status: string;
  skill: {
    id: string;
    title: string;
    description: string;
    category: string;
    level: string;
    instructor_id: string;
  } | null;
}

export const useConnection = (connectionId: string | undefined, userId: string | undefined) => {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!connectionId || !userId) {
      navigate('/');
      return;
    }
    
    const fetchConnection = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('skill_connections')
          .select(`
            *,
            skill:skills(*)
          `)
          .eq('id', connectionId)
          .eq('status', 'accepted')
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          toast({
            title: "Meeting Not Found",
            description: "This meeting may have ended or doesn't exist.",
            variant: "destructive",
          });
          navigate('/');
          return;
        }

        if (data.learner_id !== userId && data.skill?.instructor_id !== userId) {
          toast({
            title: "Unauthorized",
            description: "You don't have access to this meeting",
            variant: "destructive",
          });
          navigate('/');
          return;
        }

        setConnection(data);
        console.log("Connection loaded:", data);

      } catch (error: any) {
        console.error('Error fetching connection:', error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchConnection();
  }, [connectionId, userId, navigate, toast]);

  return { connection, loading };
};
