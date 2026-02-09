import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Switch,
  Alert,
} from 'react-native';
import { useSdk } from '../contexts/SdkContext';
import { useSdkEvents } from '../hooks/useSdkEvents';
import { useSubscription } from '../hooks/useSubscription';
import { useRoom } from '../hooks/useRoom';
import PeerVideo from '../components/PeerVideo';
import ScreenShare from '../components/ScreenShare';
import samvyo from '../../lib/rnsdk.cjs.js';

const ConferenceScreen = () => {
  const {
    sdkInstance,
    isInitialized,
    isJoined,
    peers,
    screenShares,
    availableTracks,
    setSubscribedPeers: setSubscribedPeersContext,
    setStagedPeers: setStagedPeersContext,
  } = useSdk();

  const {
    roomId,
    setRoomId,
    peerName,
    setPeerName,
    roomType,
    setRoomType,
    participantRole,
    setParticipantRole,
    isMuted,
    isCameraOff,
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
  } = useRoom();

  const {
    setSubscriptions,
    subscribeToPeers,
    unsubscribeFromPeers,
    autoSubscribeVisiblePeers,
    subscribeToAll,
    unsubscribeFromAll,
    subscribedPeers,
    stagedPeers,
  } = useSubscription();

  // Expose setActiveSpeakerId for useSdkEvents to update
  const activeSpeakerIdRef = React.useRef(activeSpeakerId);
  React.useEffect(() => {
    activeSpeakerIdRef.current = activeSpeakerId;
  }, [activeSpeakerId]);

  // Setup SDK events with active speaker callback
  useSdkEvents((peerId) => {
    setActiveSpeakerId(peerId);
  });

  // Device management
  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [showDeviceModal, setShowDeviceModal] = useState(false);

  // UI state
  const [callStatus, setCallStatus] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // Pagination and layout state (similar to ConferenceRoom.jsx)
  const [currentPage, setCurrentPage] = useState(1);
  const [divisionNumber] = useState(6); // Peers per page
  const [pinnedPeerId, setPinnedPeerId] = useState(null);
  const [spotlightPeerId, setSpotlightPeerId] = useState(null);
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);
  
  // Stage routing state
  const [isStageRoutingActive, setIsStageRoutingActive] = useState(false);
  const [localOnStage, setLocalOnStage] = useState(false);
  const [localBackStage, setLocalBackStage] = useState(false);
  const [stagePeers, setStagePeers] = useState([]);
  const [backStagePeers, setBackStagePeers] = useState([]);
  
  // Sorted peer IDs for subscription management
  const [sortedPeerIds, setSortedPeerIds] = useState([]);

  useEffect(() => {
    getAllDevices();
  }, []);

  // Update sorted peer IDs when peers change
  useEffect(() => {
    const peerIds = Array.from(peers.keys());
    setSortedPeerIds(peerIds);
  }, [peers]);

  // Priority-based subscription management - similar to ConferenceRoom.jsx (lines 1009-1228)
  useEffect(() => {
    try {
      if (!sdkInstance || !isJoined) return;
      
      const hasSetSubscriptions = typeof sdkInstance.setSubscriptions === 'function';
      const hasGetSnapshot = typeof sdkInstance.getEffectiveSubscriptionSnapshot === 'function';
      
      if (!hasSetSubscriptions) {
        console.warn('SDK missing setSubscriptions API');
        return;
      }
      
      const myPeerId = sdkInstance?.data?.inputParams?.peerId;
      if (!myPeerId) return;

      const getParticipantNameById = (id) => {
        const peer = peers.get(id);
        return peer?.peerName || `Peer-${id?.substring(0, 6)}` || 'unknown';
      };

      // Get all visible peer IDs (sorted order)
      const allVisibleIds = sortedPeerIds.length > 0 ? sortedPeerIds : Array.from(peers.keys());

      // Normalize peer ID (remove -screen suffix if present)
      const normalizeBase = (id) => (id && id.endsWith('-screen') ? id.replace(/-screen$/, '') : id);

      // Stage routing logic
      const stageActive = isStageRoutingActive && (stagePeers.length > 0 || backStagePeers.length > 0);
      const allowedSet = stageActive 
        ? new Set(localBackStage ? backStagePeers : (localOnStage ? stagePeers : stagePeers))
        : null;
      
      const isAllowed = (id) => {
        if (!stageActive || !allowedSet) return true;
        return allowedSet.has(normalizeBase(id));
      };

      // Calculate pagination
      const totalPages = Math.ceil((allVisibleIds.length - 1) / divisionNumber); // -1 to exclude self
      const currentPaginatedIds = allVisibleIds
        .filter(id => normalizeBase(id) !== myPeerId)
        .slice((currentPage - 1) * divisionNumber, currentPage * divisionNumber);
      const currentPageSet = new Set(currentPaginatedIds.map(normalizeBase));

      const slicePage = (page) => {
        if (page < 1 || page > totalPages) return [];
        return allVisibleIds
          .filter(id => normalizeBase(id) !== myPeerId)
          .slice(
            (page - 1) * divisionNumber,
            (page - 1) * divisionNumber + divisionNumber
          );
      };

      const getPeerPage = (peerId) => {
        const filteredIds = allVisibleIds.filter(id => normalizeBase(id) !== myPeerId);
        const index = filteredIds.indexOf(peerId);
        if (index === -1) return -1;
        return Math.floor(index / divisionNumber) + 1;
      };
      
      const isOnCurrentPage = (baseId) => {
        return currentPageSet.has(baseId);
      };

      // Priority peers (always subscribe)
      const priorityPeers = new Set([
        pinnedPeerId,
        spotlightPeerId,
        activeSpeakerId
      ].filter(Boolean).map(normalizeBase));

      const toSubscribe = new Set();
      const toStage = new Set();
      const peerStates = new Map();

      // Process all visible peers
      for (const peerId of allVisibleIds) {
        const baseId = normalizeBase(peerId);
        if (baseId === myPeerId) continue;
        if (!isAllowed(peerId)) continue;

        const peerPage = getPeerPage(peerId);
        const peerName = getParticipantNameById(baseId);
        const isPriority = priorityPeers.has(baseId);
        const pageDistance = peerPage > 0 ? Math.abs(peerPage - currentPage) : Infinity;

        if (isPriority) {
          // Priority peers: always subscribe
          toSubscribe.add(baseId);
          let reason = peerPage > 0 ? `Page ${peerPage}` : 'Unknown page';
          if (baseId === normalizeBase(pinnedPeerId)) reason += ' + PINNED';
          if (baseId === normalizeBase(spotlightPeerId)) reason += ' + SPOTLIGHT';
          if (baseId === normalizeBase(activeSpeakerId)) reason += ' + ACTIVE_SPEAKER';
          peerStates.set(baseId, { state: 'SUBSCRIBED', reason, page: peerPage, name: peerName });
        } else if (isOnCurrentPage(baseId)) {
          // Current page: subscribe
          toSubscribe.add(baseId);
          peerStates.set(baseId, { 
            state: 'SUBSCRIBED', 
            reason: `Current Page (${peerPage}) - ACTUAL`, 
            page: peerPage, 
            name: peerName 
          });
        } else if (pageDistance === 1) {
          // Adjacent page: stage (preload but pause)
          toStage.add(baseId);
          const direction = peerPage < currentPage ? 'PREV' : 'NEXT';
          peerStates.set(baseId, { 
            state: 'STAGED', 
            reason: `${direction} Page (${peerPage})`, 
            page: peerPage, 
            name: peerName 
          });
        } else {
          // Far page: unsubscribe
          peerStates.set(baseId, { 
            state: 'UNSUBSCRIBED', 
            reason: `Far Page (${peerPage}, distance: ${pageDistance})`, 
            page: peerPage, 
            name: peerName 
          });
        }
      }

      // Apply subscriptions
      const result = sdkInstance.setSubscriptions({
        peerIds: Array.from(toSubscribe),
        stagedPeerIds: Array.from(toStage),
      });

      // Update context state
      if (result?.success !== false) {
        setSubscribedPeersContext(toSubscribe);
        setStagedPeersContext(toStage);
      }

      // Log subscription state (similar to ConferenceRoom.jsx)
      console.group(`📡 SUBSCRIPTION STATE [Page ${currentPage}/${totalPages}] - ${divisionNumber} peers/page`);
      
      console.log(`📄 PAGE LAYOUT:`);
      for (let p = 1; p <= totalPages; p++) {
        const pagePeers = slicePage(p);
        const pageState = p === currentPage ? '🟢 SUBSCRIBED' : 
                         Math.abs(p - currentPage) === 1 ? '🟡 STAGED' : '🔴 UNSUBSCRIBED';
        const peerNames = pagePeers.map(id => getParticipantNameById(normalizeBase(id))).join(', ');
        console.log(`  Page ${p}: ${pageState} → [${peerNames || 'empty'}]`);
      }

      console.log('');
      console.log(`🟢 SUBSCRIBED (${toSubscribe.size} peers - media flowing):`);
      if (toSubscribe.size > 0) {
        Array.from(toSubscribe).forEach(id => {
          const info = peerStates.get(id);
          console.log(`  • ${info?.name || id} — ${info?.reason || 'unknown'}`);
        });
      } else {
        console.log('  (none)');
      }
      
      console.log('');
      console.log(`🟡 STAGED (${toStage.size} peers - ready for instant switch):`);
      if (toStage.size > 0) {
        Array.from(toStage).forEach(id => {
          const info = peerStates.get(id);
          console.log(`  • ${info?.name || id} — ${info?.reason || 'unknown'}`);
        });
      } else {
        console.log('  (none)');
      }
      
      const unsubscribedPeers = Array.from(peerStates.entries()).filter(([_, info]) => info.state === 'UNSUBSCRIBED');
      console.log('');
      console.log(`🔴 UNSUBSCRIBED (${unsubscribedPeers.length} peers - no bandwidth):`);
      if (unsubscribedPeers.length > 0) {
        unsubscribedPeers.forEach(([id, info]) => {
          console.log(`  • ${info?.name || id} — ${info?.reason || 'unknown'}`);
        });
      } else {
        console.log('  (none)');
      }

      console.log('');
      console.log(`📊 SUMMARY:`);
      console.log(`  • Total Peers: ${allVisibleIds.length - 1} (excluding self)`);
      console.log(`  • Subscribed: ${toSubscribe.size} (media flowing)`);
      console.log(`  • Staged: ${toStage.size} (paused, ready)`);
      console.log(`  • Unsubscribed: ${unsubscribedPeers.length} (no consumers)`);
      console.log(`  • Current Page: ${currentPage} of ${totalPages}`);
      console.log(`  • Peers Per Page: ${divisionNumber}`);
      if (pinnedPeerId) console.log(`  • 📌 Pinned: ${getParticipantNameById(normalizeBase(pinnedPeerId))}`);
      if (spotlightPeerId) console.log(`  • 🔦 Spotlight: ${getParticipantNameById(normalizeBase(spotlightPeerId))}`);
      if (activeSpeakerId) console.log(`  • 🎤 Active Speaker: ${getParticipantNameById(normalizeBase(activeSpeakerId))}`);
      
      // Get subscription snapshot if available
      if (hasGetSnapshot) {
        console.log('');
        console.log(`📸 SDK SNAPSHOT:`);
        try {
          const snapshot = sdkInstance.getEffectiveSubscriptionSnapshot();
          if (snapshot) {
            console.log(`  • Manual Mode: ${snapshot.manual}`);
            console.log(`  • Self Peer ID: ${snapshot.selfPeerId}`);
            if (snapshot.desired) {
              console.log(`  • Desired Active: [${snapshot.desired.activePeers?.map(id => getParticipantNameById(id)).join(', ') || 'none'}]`);
              console.log(`  • Desired Staged: [${snapshot.desired.stagedPeers?.map(id => getParticipantNameById(id)).join(', ') || 'none'}]`);
            }
            if (snapshot.effective) {
              console.log(`  • Effective Active: [${snapshot.effective.activePeers?.map(id => getParticipantNameById(id)).join(', ') || 'none'}]`);
              console.log(`  • Effective Staged: [${snapshot.effective.stagedPeers?.map(id => getParticipantNameById(id)).join(', ') || 'none'}]`);
            }
          }
        } catch (e) {
          console.log('  (snapshot unavailable)', e.message);
        }
      }
      
      console.groupEnd();
    } catch (e) {
      console.warn('Subscription effect failed', e);
    }
  }, [
    sdkInstance,
    isJoined,
    // Re-run when peers change (includes new peers joining)
    sortedPeerIds.join('|'),
    peers.size,
    // Current page
    currentPage,
    divisionNumber,
    // Priority peers
    pinnedPeerId,
    spotlightPeerId,
    activeSpeakerId,
    // Stage routing
    isStageRoutingActive,
    localOnStage,
    localBackStage,
    stagePeers.join('|'),
    backStagePeers.join('|'),
    // Subscription function and context setters
    setSubscriptions,
    setSubscribedPeersContext,
    setStagedPeersContext,
  ]);

  const getAllDevices = async () => {
    try {
      const availableDevices = await samvyo.RNSdk.listDevices();
      if (availableDevices.success) {
        setAudioDevices(availableDevices.deviceList.audioDevices);
        setVideoDevices(availableDevices.deviceList.videoDevices);
        if (availableDevices.deviceList.audioDevices.length > 0) {
          setSelectedAudioDeviceId(
            availableDevices.deviceList.audioDevices[0].deviceId
          );
        }
        if (availableDevices.deviceList.videoDevices.length > 0) {
          setSelectedVideoDeviceId(
            availableDevices.deviceList.videoDevices[0].deviceId
          );
        }
      }
    } catch (error) {
      console.log('Error getting devices', error);
    }
  };

  const handleInitRoom = async () => {
    const success = await initializeRoom();
    if (success) {
      setCallStatus('Room initialized successfully');
    }
  };

  const handleJoinRoom = async () => {
    const success = await joinRoomCall();
    if (success) {
      setCallStatus('Call started successfully!');
      // Subscriptions are now managed automatically via useEffect
      // No need to manually call subscribeToAll()
    }
  };

  const handleLeaveRoom = async () => {
    await leaveRoomCall();
    setCallStatus('');
  };

  const handleToggleRecording = async () => {
    if (!sdkInstance) return;
    try {
      if (isRecording) {
        await sdkInstance.stopRecording();
        setIsRecording(false);
      } else {
        await sdkInstance.startRecording({ recordingType: 'av' });
        setIsRecording(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle recording: ' + (error.message || 'Unknown error'));
    }
  };

  const handleToggleHandRaise = async () => {
    if (!sdkInstance) return;
    try {
      if (handRaised) {
        await sdkInstance.dropHand();
        setHandRaised(false);
      } else {
        await sdkInstance.raiseHand();
        setHandRaised(true);
      }
    } catch (error) {
      Alert.alert('Hand Raise', error?.message || 'Unable to update hand status');
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !sdkInstance) return;
    try {
      await sdkInstance.sendCustomMessage(chatInput.trim(), 'chat', null, resolvedPeerType, 'public');
      setChatMessages(prev => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          from: 'You',
          text: chatInput.trim(),
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      setChatInput('');
    } catch (error) {
      Alert.alert('Chat', error?.message || 'Unable to send message');
    }
  };

  const handleSubscribeToPeer = (peerId) => {
    subscribeToPeers([peerId]);
  };

  const handleUnsubscribeFromPeer = (peerId) => {
    unsubscribeFromPeers([peerId]);
  };

  const handleSubscribeToVisible = () => {
    const visiblePeerIds = Array.from(peers.keys()).slice(0, 6);
    autoSubscribeVisiblePeers(visiblePeerIds);
  };

  const changeAudioDevice = async (deviceId) => {
    if (!sdkInstance) return;
    try {
      await sdkInstance.changeAudioInput({ deviceId });
      setSelectedAudioDeviceId(deviceId);
    } catch (error) {
      console.log('Error changing audio device', error);
    }
  };

  const changeVideoDevice = async (deviceId) => {
    if (!sdkInstance) return;
    try {
      await sdkInstance.changeVideoInput({ deviceId });
      setSelectedVideoDeviceId(deviceId);
    } catch (error) {
      console.log('Error changing video device', error);
    }
  };

  const roleOptions =
    roomType === 'event'
      ? ['moderator', 'presenter', 'attendee']
      : ['moderator', 'participant'];

  const peersArray = Array.from(peers.values());
  const screenSharesArray = Array.from(screenShares.values());
  const localPeerId = sdkInstance?.data?.inputParams?.peerId || 'me';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.inputSection}>
          <TextInput
            style={styles.input}
            placeholder="Enter Room ID"
            value={roomId}
            onChangeText={setRoomId}
          />
          <TextInput
            style={styles.input}
            placeholder="Your Name"
            value={peerName}
            onChangeText={setPeerName}
          />

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Room Type</Text>
            <View style={styles.inlineOptions}>
              {['conferencing', 'event', 'p2p'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.pillButton,
                    roomType === type && styles.pillButtonActive,
                  ]}
                  onPress={() => setRoomType(type)}>
                  <Text
                    style={[
                      styles.pillButtonText,
                      roomType === type && styles.pillButtonTextActive,
                    ]}>
                    {type.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Join As</Text>
            <View style={styles.inlineOptions}>
              {roleOptions.map(role => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.pillButton,
                    participantRole === role && styles.pillButtonActive,
                  ]}
                  onPress={() => setParticipantRole(role)}>
                  <Text
                    style={[
                      styles.pillButtonText,
                      participantRole === role && styles.pillButtonTextActive,
                    ]}>
                    {role.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.helperText}>
              {resolvedPeerType === 'attendee'
                ? 'Attendees join in view-only mode.'
                : 'Moderators and presenters can publish audio/video.'}
            </Text>
          </View>

          <View style={styles.buttonRow}>
            {!isInitialized ? (
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleInitRoom}
                disabled={!roomId.trim()}>
                <Text style={styles.buttonText}>Init Room</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleJoinRoom}
                  disabled={!roomId.trim()}>
                  <Text style={styles.buttonText}>Join Room</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleLeaveRoom}
                  disabled={!sdkInstance}>
                  <Text style={styles.buttonText}>Leave Room</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <Text style={styles.statusText}>{callStatus}</Text>

          {/* Subscription Status & Debug Controls */}
          {/* Note: Subscriptions are managed AUTOMATICALLY based on visible peers */}
          {/* These buttons are for debugging/admin purposes only */}
          {isJoined && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Subscription Status</Text>
              <Text style={styles.helperText}>
                Auto-managed: Subscribed to {subscribedPeers.size} peers | Staged: {stagedPeers.size} | Available Tracks: {availableTracks.size}
              </Text>
              <Text style={[styles.helperText, { fontSize: 10, fontStyle: 'italic', marginTop: 4 }]}>
                (Subscriptions update automatically as peers join/leave)
              </Text>
              <View style={styles.inlineOptions}>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={subscribeToAll}>
                  <Text style={styles.smallButtonText}>Subscribe All (Debug)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={unsubscribeFromAll}>
                  <Text style={styles.smallButtonText}>Unsubscribe All (Debug)</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.deviceButton}
            onPress={() => setShowDeviceModal(true)}>
            <Text style={styles.deviceButtonText}>Select Devices</Text>
          </TouchableOpacity>

          {sdkInstance && (
            <View style={styles.mediaControls}>
              <TouchableOpacity
                style={[styles.mediaButton, isMuted && styles.activeMediaButton]}
                onPress={toggleMute}
                disabled={!canProduceMedia}>
                <Text style={styles.mediaButtonText}>
                  {isMuted ? 'Unmute' : 'Mute'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.mediaButton,
                  isCameraOff && styles.activeMediaButton,
                ]}
                onPress={toggleCamera}
                disabled={!canProduceMedia}>
                <Text style={styles.mediaButtonText}>
                  {isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.mediaButton,
                  isScreenSharing && styles.activeMediaButton,
                ]}
                onPress={toggleScreenShare}
                disabled={!canProduceMedia}>
                <Text style={styles.mediaButtonText}>
                  {isScreenSharing ? 'Stop Share' : 'Share Screen'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.mediaButton,
                  isRecording && styles.activeMediaButton,
                ]}
                onPress={handleToggleRecording}
                disabled={!isModeratorRole}>
                <Text style={styles.mediaButtonText}>
                  {isRecording ? 'Stop Recording' : 'Start Recording'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <Text style={styles.recordingText}>Recording in Progress</Text>
            </View>
          )}

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Engagement</Text>
            <View style={styles.inlineOptions}>
              <TouchableOpacity style={styles.smallButton} onPress={handleToggleHandRaise}>
                <Text style={styles.smallButtonText}>
                  {handRaised ? 'Lower Hand' : 'Raise Hand'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Chat</Text>
            <View style={styles.chatLog}>
              {chatMessages.length === 0 ? (
                <Text style={styles.helperText}>No messages yet</Text>
              ) : (
                chatMessages.slice(-25).map(msg => (
                  <Text key={msg.id} style={styles.chatMessage}>
                    {msg.from}: {msg.text}
                  </Text>
                ))
              )}
            </View>
            <View style={styles.chatInputRow}>
              <TextInput
                style={[styles.input, styles.chatInput]}
                placeholder="Type message"
                value={chatInput}
                onChangeText={setChatInput}
              />
              <TouchableOpacity style={styles.smallButton} onPress={handleSendChatMessage}>
                <Text style={styles.smallButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>

          {screenSharesArray.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Screen Shares</Text>
              {screenSharesArray.map(share => (
                <ScreenShare key={share.peerId} share={share} />
              ))}
            </View>
          )}

          {peersArray.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Participants</Text>
              {peersArray.map(peer => (
                <View key={peer.peerId}>
                  <PeerVideo
                    peer={peer}
                    isModerator={isModeratorRole}
                    localPeerId={localPeerId}
                  />
                  {/* Individual subscribe buttons removed - subscriptions managed automatically */}
                  {/* Uncomment below for manual per-peer subscription controls */}
                  {/* {isJoined && (
                    <View style={styles.inlineOptions}>
                      {subscribedPeers.has(peer.peerId) ? (
                        <TouchableOpacity
                          style={styles.smallButton}
                          onPress={() => handleUnsubscribeFromPeer(peer.peerId)}>
                          <Text style={styles.smallButtonText}>Unsubscribe</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.smallButton}
                          onPress={() => handleSubscribeToPeer(peer.peerId)}>
                          <Text style={styles.smallButtonText}>Subscribe</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )} */}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Device Selection Modal */}
        <Modal
          visible={showDeviceModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDeviceModal(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Devices</Text>

              <Text style={styles.deviceSectionTitle}>Audio Devices</Text>
              {audioDevices.length > 0 ? (
                audioDevices.map(device => (
                  <TouchableOpacity
                    key={device.deviceId}
                    style={[
                      styles.deviceOption,
                      selectedAudioDeviceId === device.deviceId &&
                        styles.selectedDevice,
                    ]}
                    onPress={() => changeAudioDevice(device.deviceId)}>
                    <Text style={styles.deviceOptionText}>{device.label}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noDevicesText}>No audio devices available</Text>
              )}

              <Text style={styles.deviceSectionTitle}>Video Devices</Text>
              {videoDevices.length > 0 ? (
                videoDevices.map(device => (
                  <TouchableOpacity
                    key={device.deviceId}
                    style={[
                      styles.deviceOption,
                      selectedVideoDeviceId === device.deviceId &&
                        styles.selectedDevice,
                    ]}
                    onPress={() => changeVideoDevice(device.deviceId)}>
                    <Text style={styles.deviceOptionText}>{device.label}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noDevicesText}>No video devices available</Text>
              )}

              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setShowDeviceModal(false)}>
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    padding: 16,
  },
  inputSection: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  primaryButton: {
    backgroundColor: '#4285F4',
    marginBottom: 10,
  },
  secondaryButton: {
    backgroundColor: '#EA4335',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    color: '#555',
  },
  deviceButton: {
    backgroundColor: '#34A853',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  deviceButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  mediaControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inlineOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 8,
  },
  mediaButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#FBBC05',
    marginHorizontal: 4,
  },
  activeMediaButton: {
    backgroundColor: '#555',
  },
  mediaButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  pillButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  pillButtonActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  pillButtonText: {
    fontWeight: '600',
    color: '#1e293b',
  },
  pillButtonTextActive: {
    color: '#fff',
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#333',
  },
  helperText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  smallButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    marginRight: 8,
    marginBottom: 8,
  },
  smallButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
  chatLog: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  chatMessage: {
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 4,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    marginRight: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  deviceSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  deviceOption: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  selectedDevice: {
    backgroundColor: '#e0e0ff',
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  deviceOptionText: {
    fontSize: 14,
  },
  noDevicesText: {
    fontStyle: 'italic',
    color: '#888',
    marginBottom: 12,
  },
  closeModalButton: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#4285F4',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  recordingIndicator: {
    backgroundColor: '#ff4444',
    padding: 8,
    borderRadius: 4,
    marginBottom: 16,
    alignItems: 'center',
  },
  recordingText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default ConferenceScreen;
