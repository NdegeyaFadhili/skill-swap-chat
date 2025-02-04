
import { supabase } from "@/integrations/supabase/client";

export const setupPresenceChannel = (
  meetingId: string,
  userId: string,
  learnerId: string,
  instructorId: string
) => {
  const presenceChannel = supabase.channel(`presence:${meetingId}`);

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      console.log('Presence state:', state);
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('User joined:', key, newPresences);
    })
    .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('User left:', key, leftPresences);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          user_id: userId,
          online_at: new Date().toISOString(),
          is_instructor: userId === instructorId
        });
      }
    });

  return presenceChannel;
};
