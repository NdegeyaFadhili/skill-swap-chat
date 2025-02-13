
import { supabase } from "@/integrations/supabase/client";

export type PresenceState = {
  [key: string]: {
    user_id: string;
    online_at: string;
    is_instructor: boolean;
    status?: 'joined' | 'ready';
  }[];
};

export const setupPresenceChannel = (
  meetingId: string,
  userId: string,
  learnerId: string,
  instructorId: string,
  onPresenceChange?: (state: PresenceState) => void
) => {
  console.log('Setting up presence channel for meeting:', meetingId);
  console.log('Participants:', { userId, learnerId, instructorId });

  const presenceChannel = supabase.channel(`presence:${meetingId}`, {
    config: {
      presence: {
        key: userId,
      },
    },
  });

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState<PresenceState>();
      console.log('Presence state synced:', state);
      if (onPresenceChange) {
        onPresenceChange(state);
      }
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('User joined:', key, newPresences);
    })
    .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('User left:', key, leftPresences);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const presence = {
          user_id: userId,
          online_at: new Date().toISOString(),
          is_instructor: userId === instructorId,
          status: 'joined'
        };
        console.log('Tracking presence:', presence);
        await presenceChannel.track(presence);
      }
    });

  return presenceChannel;
};
