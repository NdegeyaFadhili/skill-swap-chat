import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MeetingHeader } from "@/components/meeting/MeetingHeader";
import { ChatRoom } from "@/components/meeting/ChatRoom";
import { MediaRoom } from "@/components/meeting/MediaRoom";
import { startMediaStream, checkDevicePermissions } from "@/utils/mediaUtils";

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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [peerStream, setPeerStream] = useState<MediaStream | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!connectionId || !user) {
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

        if (data.learner_id !== user.id && data.skill?.instructor_id !== user.id) {
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

        if (meetingType !== 'chat') {
          const { error } = await checkDevicePermissions(meetingType as 'video' | 'audio');
          if (error) setDeviceError(error);
        }

        setupPresenceChannel(data.id, user.id, data.learner_id, data.skill?.instructor_id || '');
        setupCallChannel(data.id, user.id, data.learner_id, data.skill?.instructor_id || '');

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

    const messageChannel = supabase.channel(`chat:${connectionId}`)
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        if (payload) {
          setMessages(prev => [...prev, payload]);
        }
      })
      .subscribe();

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

  const setupCallChannel = (
    meetingId: string,
    userId: string,
    learnerId: string,
    instructorId: string
  ) => {
    const callChannel = supabase.channel(`call:${meetingId}`);

    callChannel
      .on('broadcast', { event: 'stream-ready' }, async ({ payload }) => {
        console.log('Stream ready from:', payload.userId);
        
        if (!stream && payload.userId !== user?.id) {
          await handleMediaToggle();
        }
      })
      .subscribe();

    return callChannel;
  };

  const handleMediaToggle = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
        return;
      }

      const { stream: newStream, error } = await startMediaStream(meetingType as 'video' | 'audio');
      if (error) {
        setDeviceError(error);
        toast({
          title: "Media Error",
          description: error,
          variant: "destructive",
        });
        return;
      }

      setStream(newStream);
      setDeviceError(null);

      const streamChannel = supabase.channel(`stream:${connectionId}`);
      await streamChannel.subscribe();
      
      await streamChannel.send({
        type: 'broadcast',
        event: 'stream-ready',
        payload: { userId: user?.id },
      });

      if (connection && !peerStream) {
        setupPeerConnection(newStream, connection.learner_id, connection.skill?.instructor_id || '');
      }

      toast({
        title: `${meetingType === 'video' ? 'Video' : 'Audio'} Started`,
        description: "Your media stream is now active",
      });
    } catch (error: any) {
      console.error('Error toggling media:', error);
      setDeviceError(error.message);
    }
  };

  const setupPeerConnection = async (
    localStream: MediaStream,
    learnerId: string,
    instructorId: string
  ) => {
    try {
      const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      const peerConnection = new RTCPeerConnection(configuration);

      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      peerConnection.ontrack = (event) => {
        console.log('Received remote track');
        setPeerStream(event.streams[0]);
      };

      const signalingChannel = supabase.channel(`signaling:${connectionId}`);
      
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          await signalingChannel.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: { candidate: event.candidate, userId: user?.id },
          });
        }
      };

      if (user?.id === instructorId) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        await signalingChannel.send({
          type: 'broadcast',
          event: 'offer',
          payload: { offer, userId: user.id },
        });
      }

      signalingChannel
        .on('broadcast', { event: 'offer' }, async ({ payload }) => {
          if (payload.userId !== user?.id) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            await signalingChannel.send({
              type: 'broadcast',
              event: 'answer',
              payload: { answer, userId: user?.id },
            });
          }
        })
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          if (payload.userId !== user?.id) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer));
          }
        })
        .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
          if (payload.userId !== user?.id) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }
        })
        .subscribe();

    } catch (error) {
      console.error('Error setting up peer connection:', error);
      toast({
        title: "Connection Error",
        description: "Failed to establish peer connection",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async (content: string) => {
    if (!connection) return;

    const message = {
      sender_id: user?.id,
      content,
      timestamp: new Date(),
    };

    await supabase.channel(`chat:${connectionId}`).send({
      type: 'broadcast',
      event: 'message',
      payload: message,
    });

    setMessages(prev => [...prev, message]);
  };

  const endMeeting = async () => {
    if (!connection) return;

    try {
      await supabase
        .from('skill_connections')
        .update({ status: 'completed' })
        .eq('id', connectionId);

      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      navigate('/');
    } catch (error) {
      console.error('Error ending meeting:', error);
    }
  };

  const switchMeetingType = (type: string) => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    navigate(`/meeting/${connectionId}?type=${type}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading meeting details...</p>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Unable to load meeting details. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-3xl mx-auto">
        <MeetingHeader
          skillTitle={connection.skill?.title || ''}
          meetingType={meetingType}
          onSwitchType={switchMeetingType}
          onEndMeeting={endMeeting}
        />
        <CardContent>
          {meetingType === 'chat' ? (
            <ChatRoom
              messages={messages}
              currentUserId={user?.id || ''}
              onSendMessage={sendMessage}
            />
          ) : (
            <MediaRoom
              type={meetingType as 'video' | 'audio'}
              stream={stream}
              peerStream={peerStream}
              deviceError={deviceError}
              isLearner={connection.learner_id === user?.id}
              onToggleStream={handleMediaToggle}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
