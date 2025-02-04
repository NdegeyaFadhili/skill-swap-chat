
export const startMediaStream = async (type: 'video' | 'audio') => {
  try {
    // Request permissions and get stream
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: type === 'video',
      audio: true,
    });
    
    return { stream: mediaStream, error: null };
  } catch (error: any) {
    let errorMessage = error.message;
    
    if (error.name === 'NotFoundError') {
      errorMessage = `${type === 'video' ? 'Camera' : 'Microphone'} not found. Please check your device connections.`;
    } else if (error.name === 'NotAllowedError') {
      errorMessage = `Please allow access to your ${type === 'video' ? 'camera' : 'microphone'} to join the meeting.`;
    }
    
    return { stream: null, error: errorMessage };
  }
};

export const checkDevicePermissions = async (type: 'video' | 'audio') => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasVideoDevice = devices.some(device => device.kind === 'videoinput');
    const hasAudioDevice = devices.some(device => device.kind === 'audioinput');

    if (type === 'video' && !hasVideoDevice) {
      return { error: 'No camera found. Please connect a camera and try again.' };
    }

    if (!hasAudioDevice) {
      return { error: 'No microphone found. Please connect a microphone and try again.' };
    }

    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};
