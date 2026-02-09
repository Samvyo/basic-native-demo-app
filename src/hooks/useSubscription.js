import { useEffect, useCallback, useRef } from 'react';
import { useSdk } from '../contexts/SdkContext';

/**
 * Hook for managing manual subscriptions in manualSubscription mode
 * Similar to ConferenceRoom.jsx subscription management
 */
export const useSubscription = () => {
  const {
    sdkInstance,
    peers,
    subscribedPeers,
    stagedPeers,
    setSubscribedPeers,
    setStagedPeers,
    availableTracks,
  } = useSdk();

  const subscriptionTimeoutRef = useRef(null);

  /**
   * Set subscriptions for peers
   * @param {Object} options
   * @param {string[]} options.peerIds - Peer IDs to actively subscribe to
   * @param {string[]} options.stagedPeerIds - Peer IDs to stage (preload but pause)
   * @param {string[]} options.mediaTags - Optional media tags filter
   */
  const setSubscriptions = useCallback(
    ({ peerIds = [], stagedPeerIds = [], mediaTags = [] } = {}) => {
      if (!sdkInstance || typeof sdkInstance.setSubscriptions !== 'function') {
        console.warn('setSubscriptions not available');
        return { success: false, reason: 'SDK not ready or method not available' };
      }

      const myPeerId = sdkInstance?.data?.inputParams?.peerId;
      const activeIds = (Array.isArray(peerIds) ? peerIds : [])
        .filter(Boolean)
        .filter(id => id !== myPeerId);

      const stagedIds = (Array.isArray(stagedPeerIds) ? stagedPeerIds : [])
        .filter(Boolean)
        .filter(id => id !== myPeerId);

      try {
        const result = sdkInstance.setSubscriptions({
          peerIds: activeIds,
          stagedPeerIds: stagedIds,
          mediaTags: Array.isArray(mediaTags) ? mediaTags : [],
        });

        console.log(result)

        if (result.success) {
          setSubscribedPeers(new Set(activeIds));
          setStagedPeers(new Set(stagedIds));
        }

        return result;
      } catch (error) {
        console.error('setSubscriptions error:', error);
        return { success: false, reason: error.message };
      }
    },
    [sdkInstance, setSubscribedPeers, setStagedPeers]
  );

  /**
   * Subscribe to specific peers
   */
  const subscribeToPeers = useCallback(
    (peerIds, mediaTags = []) => {
      if (!sdkInstance || typeof sdkInstance.subscribePeers !== 'function') {
        return { success: false, reason: 'SDK not ready' };
      }

      const list = (Array.isArray(peerIds) ? peerIds : []).filter(Boolean);
      if (list.length === 0) return { success: true };

      try {
        const result = sdkInstance.subscribePeers(list, mediaTags);
        if (result.success) {
          setSubscribedPeers(prev => {
            const newSet = new Set(prev);
            list.forEach(id => newSet.add(id));
            return newSet;
          });
        }
        return result;
      } catch (error) {
        console.error('subscribePeers error:', error);
        return { success: false, reason: error.message };
      }
    },
    [sdkInstance, setSubscribedPeers]
  );

  /**
   * Unsubscribe from specific peers
   */
  const unsubscribeFromPeers = useCallback(
    (peerIds, mediaTags = []) => {
      if (!sdkInstance || typeof sdkInstance.unsubscribePeers !== 'function') {
        return { success: false, reason: 'SDK not ready' };
      }

      const list = (Array.isArray(peerIds) ? peerIds : []).filter(Boolean);
      if (list.length === 0) return { success: true };

      try {
        const result = sdkInstance.unsubscribePeers(list, mediaTags);
        if (result.success) {
          setSubscribedPeers(prev => {
            const newSet = new Set(prev);
            list.forEach(id => newSet.delete(id));
            return newSet;
          });
        }
        return result;
      } catch (error) {
        console.error('unsubscribePeers error:', error);
        return { success: false, reason: error.message };
      }
    },
    [sdkInstance, setSubscribedPeers]
  );

  /**
   * Auto-subscribe to visible peers (current page)
   * This can be customized based on your pagination logic
   */
  const autoSubscribeVisiblePeers = useCallback(
    (visiblePeerIds = [], options = {}) => {
      const { includeStaged = true, maxStaged = 4 } = options;
      const myPeerId = sdkInstance?.data?.inputParams?.peerId;

      const visibleIds = visiblePeerIds.filter(id => id !== myPeerId);
      const allPeerIds = Array.from(peers.keys()).filter(id => id !== myPeerId);

      // Determine which peers to subscribe vs stage
      const toSubscribe = visibleIds.slice(0, 6); // Subscribe to first 6 visible
      const toStage = includeStaged
        ? allPeerIds
            .filter(id => !toSubscribe.includes(id))
            .slice(0, maxStaged)
        : [];

      return setSubscriptions({
        peerIds: toSubscribe,
        stagedPeerIds: toStage,
      });
    },
    [sdkInstance, peers, setSubscriptions]
  );

  /**
   * Subscribe to all available peers
   */
  const subscribeToAll = useCallback(() => {
    const myPeerId = sdkInstance?.data?.inputParams?.peerId;
    const allPeerIds = Array.from(peers.keys()).filter(id => id !== myPeerId);
    return setSubscriptions({ peerIds: allPeerIds });
  }, [sdkInstance, peers, setSubscriptions]);

  /**
   * Unsubscribe from all peers
   */
  const unsubscribeFromAll = useCallback(() => {
    const allPeerIds = Array.from(subscribedPeers);
    return unsubscribeFromPeers(allPeerIds);
  }, [subscribedPeers, unsubscribeFromPeers]);

  return {
    setSubscriptions,
    subscribeToPeers,
    unsubscribeFromPeers,
    autoSubscribeVisiblePeers,
    subscribeToAll,
    unsubscribeFromAll,
    subscribedPeers,
    stagedPeers,
    availableTracks,
  };
};
