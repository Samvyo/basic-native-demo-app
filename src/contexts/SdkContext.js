import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import samvyo from '../../lib/rnsdk.cjs.js';

const SdkContext = createContext(null);

export const useSdk = () => {
  const context = useContext(SdkContext);
  if (!context) {
    throw new Error('useSdk must be used within SdkProvider');
  }
  return context;
};

export const SdkProvider = ({ children }) => {
  const [sdkInstance, setSdkInstance] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [peers, setPeers] = useState(new Map());
  const [screenShares, setScreenShares] = useState(new Map());
  const [availableTracks, setAvailableTracks] = useState(new Map());
  const [subscribedPeers, setSubscribedPeers] = useState(new Set());
  const [stagedPeers, setStagedPeers] = useState(new Set());
  
  const peersRef = useRef(peers);
  const sdkInstanceRef = useRef(null);

  // Update ref when peers change
  React.useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  const initSdk = useCallback(async ({ sessionToken, roomId, peerName, roomType }) => {
    try {
      const instance = await samvyo.RNSdk.init({
        sessionToken,
        roomId,
        peerId: peerName,
        roomType: roomType || 'conferencing',
      });
      
      sdkInstanceRef.current = instance;
      setSdkInstance(instance);
      setIsInitialized(true);
      
      return instance;
    } catch (error) {
      console.error('SDK initialization error:', error);
      throw error;
    }
  }, []);

  const joinRoom = useCallback(async (params) => {
    if (!sdkInstanceRef.current) {
      throw new Error('SDK not initialized');
    }
    
    await sdkInstanceRef.current.joinRoom({
      ...params,
      manualSubscription: true, // Enable manual subscription mode
    });
    
    setIsJoined(true);
  }, []);

  const leaveRoom = useCallback(async () => {
    if (sdkInstanceRef.current) {
      await sdkInstanceRef.current.leaveRoom();
      setSdkInstance(null);
      sdkInstanceRef.current = null;
      setIsInitialized(false);
      setIsJoined(false);
      setPeers(new Map());
      setScreenShares(new Map());
      setAvailableTracks(new Map());
      setSubscribedPeers(new Set());
      setStagedPeers(new Set());
    }
  }, []);

  const addPeer = useCallback((peerId, peerName, type) => {
    setPeers(prev => {
      const newPeers = new Map(prev);
      if (!newPeers.has(peerId)) {
        newPeers.set(peerId, {
          peerId,
          peerName,
          type,
          videoTrack: null,
          audioTrack: null,
          isMuted: false,
          isCameraOff: false,
        });
      }
      return newPeers;
    });
  }, []);

  const removePeer = useCallback((peerId) => {
    setPeers(prev => {
      const newPeers = new Map(prev);
      newPeers.delete(peerId);
      return newPeers;
    });
    setSubscribedPeers(prev => {
      const newSet = new Set(prev);
      newSet.delete(peerId);
      return newSet;
    });
    setStagedPeers(prev => {
      const newSet = new Set(prev);
      newSet.delete(peerId);
      return newSet;
    });
  }, []);

  const updatePeerVideo = useCallback((peerId, videoTrack, type) => {
    setPeers(prev => {
      const newPeers = new Map(prev);
      const peer = newPeers.get(peerId);
      if (peer) {
        let stream = null;
        if (videoTrack) {
          try {
            stream = new MediaStream();
            stream.addTrack(videoTrack);
          } catch (error) {
            console.error('Error creating MediaStream:', error);
          }
        }
        peer.videoTrack = stream;
        peer.isCameraOff = false;
      }
      return newPeers;
    });
  }, []);

  const updatePeerAudio = useCallback((peerId, audioTrack, type) => {
    setPeers(prev => {
      const newPeers = new Map(prev);
      const peer = newPeers.get(peerId);
      if (peer) {
        peer.audioTrack = audioTrack;
        peer.isMuted = false;
      }
      return newPeers;
    });
  }, []);

  const removePeerVideo = useCallback((peerId, type) => {
    setPeers(prev => {
      const newPeers = new Map(prev);
      const peer = newPeers.get(peerId);
      if (peer) {
        peer.videoTrack = null;
        peer.isCameraOff = true;
      }
      return newPeers;
    });
  }, []);

  const removePeerAudio = useCallback((peerId) => {
    setPeers(prev => {
      const newPeers = new Map(prev);
      const peer = newPeers.get(peerId);
      if (peer) {
        peer.audioTrack = null;
      }
      return newPeers;
    });
  }, []);

  const updatePeerMuteStatus = useCallback((peerId, isMuted) => {
    setPeers(prev => {
      const newPeers = new Map(prev);
      const peer = newPeers.get(peerId);
      if (peer) {
        peer.isMuted = isMuted;
      }
      return newPeers;
    });
  }, []);

  const addScreenShare = useCallback((peerId, videoTrack, type) => {
    setScreenShares(prev => {
      const newShares = new Map(prev);
      let stream = null;
      if (videoTrack) {
        try {
          stream = new MediaStream();
          stream.addTrack(videoTrack);
        } catch (error) {
          console.error('Error creating MediaStream:', error);
        }
      }
      newShares.set(peerId, {
        peerId,
        videoTrack: stream,
        type,
      });
      return newShares;
    });
  }, []);

  const removeScreenShare = useCallback((peerId) => {
    setScreenShares(prev => {
      const newShares = new Map(prev);
      newShares.delete(peerId);
      return newShares;
    });
  }, []);

  const addAvailableTrack = useCallback((peerId, mediaTag, trackInfo) => {
    setAvailableTracks(prev => {
      const newTracks = new Map(prev);
      const key = `${peerId}:${mediaTag}`;
      newTracks.set(key, {
        peerId,
        mediaTag,
        ...trackInfo,
      });
      return newTracks;
    });
  }, []);

  const removeAvailableTrack = useCallback((peerId, mediaTag) => {
    setAvailableTracks(prev => {
      const newTracks = new Map(prev);
      const key = `${peerId}:${mediaTag}`;
      newTracks.delete(key);
      return newTracks;
    });
  }, []);

  const value = {
    sdkInstance: sdkInstanceRef.current,
    isInitialized,
    isJoined,
    peers,
    screenShares,
    availableTracks,
    subscribedPeers,
    stagedPeers,
    peersRef,
    initSdk,
    joinRoom,
    leaveRoom,
    addPeer,
    removePeer,
    updatePeerVideo,
    updatePeerAudio,
    removePeerVideo,
    removePeerAudio,
    updatePeerMuteStatus,
    addScreenShare,
    removeScreenShare,
    addAvailableTrack,
    removeAvailableTrack,
    setSubscribedPeers,
    setStagedPeers,
  };

  return <SdkContext.Provider value={value}>{children}</SdkContext.Provider>;
};
