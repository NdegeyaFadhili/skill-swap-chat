
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const setupPeerConnection = async (
  connectionId: string,
  localStream: MediaStream,
  userId: string,
  learnerId: string,
  instructorId: string,
  setPeerStream: (stream: MediaStream) => void
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
          payload: { candidate: event.candidate, userId },
        });
      }
    };

    if (userId === instructorId) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      await signalingChannel.send({
        type: 'broadcast',
        event: 'offer',
        payload: { offer, userId },
      });
    }

    signalingChannel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.userId !== userId) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          
          await signalingChannel.send({
            type: 'broadcast',
            event: 'answer',
            payload: { answer, userId },
          });
        }
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.userId !== userId) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer));
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.userId !== userId) {
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
