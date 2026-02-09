import { useState, useCallback, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import axios from 'axios';
import { useSdk } from '../contexts/SdkContext';

/**
 * Hook for managing room operations
 */
export const useRoom = () => {
  const { initSdk, joinRoom, leaveRoom, sdkInstance } = useSdk();
  
  const [roomId, setRoomId] = useState('');
  const [peerName, setPeerName] = useState('peer-1');
  const [roomType, setRoomType] = useState('conferencing');
  const [participantRole, setParticipantRole] = useState('moderator');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState(null);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState(null);

  const resolvedPeerType =
    roomType === 'event'
      ? participantRole === 'moderator'
        ? 'moderator'
        : participantRole === 'presenter'
        ? 'participant'
        : 'attendee'
      : participantRole === 'moderator'
      ? 'moderator'
      : 'participant';

  const canProduceMedia = resolvedPeerType !== 'attendee';
  const isModeratorRole = resolvedPeerType === 'moderator';

  const fetchSessionToken = useCallback(async (roomId) => {
    try {
      console.log('Fetching session token', { roomId });
      const data = { roomId };
      const apiUrl =
        Platform.OS === 'android'
          ? 'http://10.0.2.2:5100/api/create-session-token'
          : 'http://192.168.0.128:5100/api/create-session-token';

      const response = await axios.post(apiUrl, data);
      console.log('Session token response', {
        status: response.status,
        success: response.data.success,
      });

      if (response.data.success) {
        return response.data.sessionToken;
      } else {
        Alert.alert('Error', 'Failed to fetch session token');
        return null;
      }
    } catch (error) {
      console.log('Error fetching session token', error);
      Alert.alert('Error', 'Internal Server Error');
      return null;
    }
  }, []);

  const initializeRoom = useCallback(async () => {
    if (!roomId.trim()) {
      Alert.alert('Error', 'Room ID cannot be empty');
      return false;
    }

    try {
      const sessionToken = await fetchSessionToken(roomId);
      if (!sessionToken) {
        return false;
      }

      await initSdk({
        sessionToken,
        roomId,
        peerName,
        roomType,
      });

      return true;
    } catch (error) {
      console.error('Error initializing room:', error);
      Alert.alert('Error', error.message || 'Failed to initialize room');
      return false;
    }
  }, [roomId, peerName, roomType, initSdk, fetchSessionToken]);

  const joinRoomCall = useCallback(async () => {
    if (!roomId.trim()) {
      Alert.alert('Error', 'Room ID cannot be empty');
      return false;
    }

    try {
      const roomParams = {
        videoResolution: 'hd',
        produce: canProduceMedia,
        consume: true,
        produceAudio: canProduceMedia && !isMuted,
        produceVideo: canProduceMedia && !isCameraOff,
        forcePCMU: false,
        forceH264: false,
        h264Profile: 'high',
        forceFPS: 30,
        enableWebcamLayers: true,
        numSimulcastStreams: 3,
        videoBitRates: [500, 250, 100],
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44000,
        channelCount: 1,
        msRegion: 'us',
        backgroundImage: '',
        peerName,
        roomType,
        peerType: resolvedPeerType,
        audioDeviceId: selectedAudioDeviceId,
        videoDeviceId: selectedVideoDeviceId,
        manualSubscription: true, // Enable manual subscription mode
      };

      await joinRoom(roomParams);

      return true;
    } catch (error) {
      console.error('Error joining room:', error);
      Alert.alert('Error', error.message || 'Failed to join room');
      return false;
    }
  }, [
    roomId,
    peerName,
    roomType,
    resolvedPeerType,
    canProduceMedia,
    isMuted,
    isCameraOff,
    selectedAudioDeviceId,
    selectedVideoDeviceId,
    joinRoom,
  ]);

  const leaveRoomCall = useCallback(async () => {
    try {
      await leaveRoom();
      Alert.alert('Success', 'Successfully left the room!');
      return true;
    } catch (error) {
      console.error('Error leaving room:', error);
      Alert.alert('Error', error.message || 'Failed to leave room');
      return false;
    }
  }, [leaveRoom]);

  const toggleMute = useCallback(async () => {
    if (!sdkInstance) return;
    try {
      if (isMuted) {
        await sdkInstance.unmuteMic();
        setIsMuted(false);
      } else {
        await sdkInstance.muteMic();
        setIsMuted(true);
      }
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  }, [sdkInstance, isMuted]);

  const toggleCamera = useCallback(async () => {
    if (!sdkInstance) return;
    try {
      if (isCameraOff) {
        await sdkInstance.enableCam({
          deviceId: selectedVideoDeviceId,
        });
        setIsCameraOff(false);
      } else {
        await sdkInstance.disableCam();
        setIsCameraOff(true);
      }
    } catch (error) {
      console.error('Error toggling camera:', error);
    }
  }, [sdkInstance, isCameraOff, selectedVideoDeviceId]);

  const toggleScreenShare = useCallback(async () => {
    if (!sdkInstance) return;
    try {
      // Check if currently sharing
      const isSharing = sdkInstance._shareProducer !== null;
      if (isSharing) {
        await sdkInstance.disableShare();
      } else {
        await sdkInstance.enableShare();
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  }, [sdkInstance]);

  return {
    roomId,
    setRoomId,
    peerName,
    setPeerName,
    roomType,
    setRoomType,
    participantRole,
    setParticipantRole,
    isMuted,
    setIsMuted,
    isCameraOff,
    setIsCameraOff,
    selectedAudioDeviceId,
    setSelectedAudioDeviceId,
    selectedVideoDeviceId,
    setSelectedVideoDeviceId,
    resolvedPeerType,
    canProduceMedia,
    isModeratorRole,
    initializeRoom,
    joinRoomCall,
    leaveRoomCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
  };
};
