
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
    
    // Enhanced ICE server configuration
    const configuration = { 
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    };
    
    const peerConnection = new RTCPeerConnection(configuration);

    // Add tracks one by one and log each addition
    localStream.getTracks().forEach(track => {
      const sender = peerConnection.addTrack(track, localStream);
      console.log(`Added track to peer connection:`, {
        kind: track.kind,
        enabled: track.enabled,
        muted: track.muted
      });
    });

    // Handle incoming remote streams more robustly
    peerConnection.ontrack = (event) => {
      console.log('Received remote track:', {
        kind: event.track.kind,
        enabled: event.track.enabled,
        streams: event.streams.length
      });
      
      if (event.streams[0]) {
        setPeerStream(event.streams[0]);
        
        // Monitor remote stream status
        event.track.onmute = () => console.log('Remote track muted');
        event.track.onunmute = () => console.log('Remote track unmuted');
        event.track.onended = () => console.log('Remote track ended');
      }
    };

    const signalingChannel = supabase.channel(`signaling:${connectionId}`, {
      config: {
        broadcast: { ack: true }
      }
    });

    // Enhanced ICE candidate handling
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate:', {
          type: event.candidate.type,
          protocol: event.candidate.protocol
        });
        
        await signalingChannel.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { candidate: event.candidate, userId },
        });
      }
    };

    // Monitor connection state changes in detail
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state changed to:', peerConnection.connectionState);
      switch (peerConnection.connectionState) {
        case 'connected':
          toast({
            title: "Connected!",
            description: "Video connection established successfully.",
          });
          break;
        case 'disconnected':
          toast({
            title: "Disconnected",
            description: "Connection lost. Trying to reconnect...",
            variant: "destructive",
          });
          break;
        case 'failed':
          toast({
            title: "Connection Failed",
            description: "Unable to establish connection. Please try again.",
            variant: "destructive",
          });
          break;
      }
    };

    // Monitor ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', peerConnection.iceConnectionState);
    };

    // Monitor signaling state
    peerConnection.onsignalingstatechange = () => {
      console.log('Signaling state:', peerConnection.signalingState);
    };

    // If user is instructor, initiate the connection
    if (userId === instructorId) {
      console.log('Creating offer as instructor');
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        voiceActivityDetection: true
      });
      
      console.log('Setting local description');
      await peerConnection.setLocalDescription(offer);
      
      console.log('Sending offer');
      await signalingChannel.send({
        type: 'broadcast',
        event: 'offer',
        payload: { offer, userId },
      });
    }

    // Enhanced signaling channel handling
    signalingChannel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.userId !== userId) {
          console.log('Received offer, creating answer');
          await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.offer));
          
          const answer = await peerConnection.createAnswer({
            voiceActivityDetection: true
          });
          
          console.log('Setting local description for answer');
          await peerConnection.setLocalDescription(answer);
          
          console.log('Sending answer');
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
      .subscribe((status) => {
        console.log('Signaling channel status:', status);
      });

    // Enhanced cleanup function
    return () => {
      console.log('Cleaning up peer connection');
      localStream.getTracks().forEach(track => track.stop());
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
