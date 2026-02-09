import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RTCView } from 'react-native-webrtc';

const ScreenShare = ({ share }) => {
  return (
    <View style={styles.screenShareCard}>
      <Text style={styles.screenShareTitle}>Screen Share</Text>
      {share.videoTrack ? (
        <RTCView
          streamURL={share.videoTrack.toURL()}
          style={styles.screenShareView}
          objectFit="contain"
        />
      ) : (
        <View style={styles.noScreenShareContainer}>
          <Text style={styles.noScreenShareText}>No Screen Share</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screenShareCard: {
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
  screenShareTitle: {
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: '#f0f8ff',
  },
  screenShareView: {
    height: 240,
  },
  noScreenShareContainer: {
    height: 240,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noScreenShareText: {
    color: 'white',
    fontSize: 16,
  },
});

export default ScreenShare;
