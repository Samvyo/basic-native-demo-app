import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { RTCView } from 'react-native-webrtc';

const PeerVideo = ({ peer, isModerator, localPeerId, onUpgrade, onDowngrade, onRequest }) => {
  return (
    <View style={styles.peerCard}>
      <Text style={styles.peerName}>{peer.peerName}</Text>
      {peer.videoTrack ? (
        <RTCView
          streamURL={peer.videoTrack.toURL()}
          style={styles.videoView}
          objectFit="cover"
        />
      ) : (
        <View style={styles.noVideoContainer}>
          <Text style={styles.noVideoText}>No Video</Text>
        </View>
      )}
      {peer.isMuted && <Text style={styles.muteIndicator}>Muted</Text>}
      {peer.isCameraOff && <Text style={styles.cameraOffIndicator}>Camera Off</Text>}
      {isModerator && peer.peerId !== localPeerId && (
        <View style={styles.inlineOptions}>
          <TouchableOpacity style={styles.smallButton} onPress={() => onUpgrade?.(peer.peerId)}>
            <Text style={styles.smallButtonText}>Upgrade</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.smallButton} onPress={() => onDowngrade?.(peer.peerId)}>
            <Text style={styles.smallButtonText}>Downgrade</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.smallButton} onPress={() => onRequest?.(peer.peerId, true)}>
            <Text style={styles.smallButtonText}>Request</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  peerCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  peerName: {
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: '#f9f9f9',
  },
  videoView: {
    height: 200,
    backgroundColor: '#000',
  },
  noVideoContainer: {
    height: 200,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noVideoText: {
    color: 'white',
    fontSize: 16,
  },
  muteIndicator: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    color: 'white',
  },
  cameraOffIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    color: 'white',
  },
  inlineOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
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
});

export default PeerVideo;
