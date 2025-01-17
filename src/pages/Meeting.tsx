import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Video, PhoneCall, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  sender_id: string;
  content: string;
  timestamp: Date;
}

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
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

    // Subscribe to real-time messages
    const messageChannel = supabase.channel(`chat:${connectionId}`)
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        setMessages(prev => [...prev, payload]);
      })
      .subscribe();

    fetchConnection();

    return () => {
      channel.unsubscribe();
      messageChannel.unsubscribe();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [connectionId, user, navigate, toast]);

  const startMediaStream = async (type: 'video' | 'audio') => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true,
      });
      setStream(mediaStream);
      toast({
        title: `${type === 'video' ? 'Video' : 'Audio'} Started`,
        description: "Your media stream is now active",
      });
    } catch (error: any) {
      toast({
        title: "Media Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const stopMediaStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !connection) return;

    const message = {
      sender_id: user?.id,
      content: newMessage,
      timestamp: new Date(),
    };

    await supabase.channel(`chat:${connectionId}`).send({
      type: 'broadcast',
      event: 'message',
      payload: message,
    });

    setMessages(prev => [...prev, message]);
    setNewMessage("");
  };

  const endMeeting = async () => {
    if (!connection) return;

    try {
      await supabase
        .from('skill_connections')
        .update({ status: 'completed' })
        .eq('id', connectionId);

      stopMediaStream();
      navigate('/');
    } catch (error) {
      console.error('Error ending meeting:', error);
    }
  };

  useEffect(() => {
    if (meetingType !== 'chat') {
      startMediaStream(meetingType as 'video' | 'audio');
    }
    return () => stopMediaStream();
  }, [meetingType]);

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {meetingType === 'chat' && <MessageSquare className="h-6 w-6" />}
              {meetingType === 'video' && <Video className="h-6 w-6" />}
              {meetingType === 'audio' && <PhoneCall className="h-6 w-6" />}
              <CardTitle className="text-2xl">
                {connection.skill.title} - {meetingType.charAt(0).toUpperCase() + meetingType.slice(1)}
              </CardTitle>
            </div>
            <Button variant="destructive" size="icon" onClick={endMeeting}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {meetingType === 'chat' && (
            <div className="space-y-4">
              <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`mb-4 ${
                      message.sender_id === user?.id ? 'text-right' : 'text-left'
                    }`}
                  >
                    <div
                      className={`inline-block rounded-lg px-4 py-2 ${
                        message.sender_id === user?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
              </ScrollArea>
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <Button onClick={sendMessage}>Send</Button>
              </div>
            </div>
          )}

          {(meetingType === 'video' || meetingType === 'audio') && (
            <div className="space-y-4">
              {stream && (
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    ref={(videoEl) => {
                      if (videoEl && stream) {
                        videoEl.srcObject = stream;
                        videoEl.play();
                      }
                    }}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                </div>
              )}
              {remoteStream && (
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    ref={(videoEl) => {
                      if (videoEl && remoteStream) {
                        videoEl.srcObject = remoteStream;
                        videoEl.play();
                      }
                    }}
                    className="w-full h-full object-cover"
                    playsInline
                  />
                </div>
              )}
              <div className="flex justify-center gap-4">
                <Button
                  variant={stream ? "destructive" : "default"}
                  onClick={() => stream ? stopMediaStream() : startMediaStream(meetingType as 'video' | 'audio')}
                >
                  {stream ? 'Stop' : 'Start'} {meetingType === 'video' ? 'Video' : 'Audio'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}