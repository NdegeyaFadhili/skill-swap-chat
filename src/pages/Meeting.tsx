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
  skill: Skill | null;
}

export default function Meeting() {
  const { connectionId } = useParams();
  const [searchParams] = useSearchParams();
  const meetingType = searchParams.get('type') || 'chat';
  const [connection, setConnection] = useState<Connection | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!connectionId || !user) {
      navigate('/');
      return;
    }
    
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

      // Check if the current user is either the learner or the instructor
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

      // Check device permissions before auto-starting media
      if (meetingType !== 'chat') {
        checkDevicePermissions(meetingType as 'video' | 'audio');
      }
    };

    // Subscribe to real-time messages
    const messageChannel = supabase.channel(`chat:${connectionId}`)
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        if (payload) {
          setMessages(prev => [...prev, payload]);
        }
      })
      .subscribe();

    // Subscribe to connection updates
    const connectionChannel = supabase.channel(`meeting:${connectionId}`)
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
      messageChannel.unsubscribe();
      connectionChannel.unsubscribe();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [connectionId, user, navigate, toast, meetingType]);

  const checkDevicePermissions = async (type: 'video' | 'audio') => {
    try {
      // First check if the devices are available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideoDevice = devices.some(device => device.kind === 'videoinput');
      const hasAudioDevice = devices.some(device => device.kind === 'audioinput');

      if (type === 'video' && !hasVideoDevice) {
        setDeviceError('No camera found. Please connect a camera and try again.');
        return;
      }

      if (!hasAudioDevice) {
        setDeviceError('No microphone found. Please connect a microphone and try again.');
        return;
      }

      // If devices are available, try to start the media stream
      await startMediaStream(type);
      setDeviceError(null);
    } catch (error: any) {
      console.error('Error checking device permissions:', error);
      setDeviceError(error.message);
      toast({
        title: "Device Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const startMediaStream = async (type: 'video' | 'audio') => {
    try {
      // Request permissions first
      await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true,
      });

      // If permissions granted, get the stream
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
      console.error('Error starting media stream:', error);
      let errorMessage = error.message;
      
      if (error.name === 'NotFoundError') {
        errorMessage = `${type === 'video' ? 'Camera' : 'Microphone'} not found. Please check your device connections.`;
      } else if (error.name === 'NotAllowedError') {
        errorMessage = `Please allow access to your ${type === 'video' ? 'camera' : 'microphone'} to join the meeting.`;
      }
      
      setDeviceError(errorMessage);
      toast({
        title: "Media Error",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
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

  const switchMeetingType = (type: string) => {
    stopMediaStream();
    navigate(`/meeting/${connectionId}?type=${type}`);
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl mb-2">
                {connection.skill?.title}
              </CardTitle>
              <div className="flex gap-4">
                <Button
                  variant={meetingType === 'chat' ? "default" : "outline"}
                  size="sm"
                  onClick={() => switchMeetingType('chat')}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat
                </Button>
                <Button
                  variant={meetingType === 'video' ? "default" : "outline"}
                  size="sm"
                  onClick={() => switchMeetingType('video')}
                >
                  <Video className="h-4 w-4 mr-2" />
                  Video
                </Button>
                <Button
                  variant={meetingType === 'audio' ? "default" : "outline"}
                  size="sm"
                  onClick={() => switchMeetingType('audio')}
                >
                  <PhoneCall className="h-4 w-4 mr-2" />
                  Audio
                </Button>
              </div>
            </div>
            <Button variant="destructive" size="icon" onClick={endMeeting}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {deviceError && (
            <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
              {deviceError}
            </div>
          )}
          
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
              <div className="flex justify-center gap-4">
                <Button
                  variant={stream ? "destructive" : "default"}
                  onClick={() => stream ? stopMediaStream() : checkDevicePermissions(meetingType as 'video' | 'audio')}
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