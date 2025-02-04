
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
import { setupPeerConnection } from "@/utils/webRTCUtils";
import { setupPresenceChannel } from "@/utils/presenceUtils";
import { useConnection } from "@/hooks/useConnection";

interface Message {
  sender_id: string;
  content: string;
  timestamp: Date;
}

export default function Meeting() {
  const { connectionId } = useParams();
  const [searchParams] = useSearchParams();
  const meetingType = searchParams.get('type') || 'chat';
  const [messages, setMessages] = useState<Message[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [peerStream, setPeerStream] = useState<MediaStream | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { connection, loading } = useConnection(connectionId, user?.id);

  useEffect(() => {
    if (!connection) return;

    if (meetingType !== 'chat') {
      checkDevicePermissions(meetingType as 'video' | 'audio')
        .then(({ error }) => {
          if (error) setDeviceError(error);
        });
    }

    setupPresenceChannel(
      connection.id,
      user?.id || '',
      connection.learner_id,
      connection.skill?.instructor_id || ''
    );

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

    return () => {
      messageChannel.unsubscribe();
      connectionChannel.unsubscribe();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [connection, user?.id, meetingType, connectionId, navigate, toast, stream]);

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
        setupPeerConnection(
          connection.id,
          newStream,
          user?.id || '',
          connection.learner_id,
          connection.skill?.instructor_id || '',
          setPeerStream
        );
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
