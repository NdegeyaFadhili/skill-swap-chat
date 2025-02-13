
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
    console.log('Setting up peer connection for:', { userId, learnerId, instructorId });
    
    const configuration = { 
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
    
    const peerConnection = new RTCPeerConnection(configuration);

    // Add all tracks from local stream to peer connection
    localStream.getTracks().forEach(track => {
      console.log('Adding track to peer connection:', track.kind);
      peerConnection.addTrack(track, localStream);
    });

    // Handle incoming streams
    peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.streams[0]);
      setPeerStream(event.streams[0]);
    };

    const signalingChannel = supabase.channel(`signaling:${connectionId}`);
    
    // Handle ICE candidates
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate');
        await signalingChannel.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { candidate: event.candidate, userId },
        });
      }
    };

    // Connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        toast({
          title: "Connected!",
          description: "Video connection established successfully.",
        });
      }
    };

    // If user is instructor, create and send offer
    if (userId === instructorId) {
      console.log('Creating offer as instructor');
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await peerConnection.setLocalDescription(offer);
      
      await signalingChannel.send({
        type: 'broadcast',
        event: 'offer',
        payload: { offer, userId },
      });
    }

    // Handle incoming messages
    signalingChannel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.userId !== userId) {
          console.log('Received offer, creating answer');
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
          console.log('Received answer, setting remote description');
          const remoteDesc = new RTCSessionDescription(payload.answer);
          await peerConnection.setRemoteDescription(remoteDesc);
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.userId !== userId) {
          console.log('Received ICE candidate');
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (err) {
            console.error('Error adding ICE candidate:', err);
          }
        }
      })
      .subscribe();

    // Cleanup function
    return () => {
      peerConnection.close();
      signalingChannel.unsubscribe();
    };

  } catch (error) {
    console.error('Error setting up peer connection:', error);
    toast({
      title: "Connection Error",
      description: "Failed to establish peer connection. Please try again.",
      variant: "destructive",
    });
  }
};
