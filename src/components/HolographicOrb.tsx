import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../app/theme';
import { AgentState } from '../state/agentStore';

interface Props {
  state: AgentState;
  onPress: () => void;
}

export const HolographicOrb: React.FC<Props> = ({ state, onPress }) => {
  const isGlowing = state === 'LISTENING' || state === 'SPEAKING' || state === 'EXECUTING';

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.container}>
      <View style={[styles.outerRing, isGlowing && styles.outerRingGlow]}>
        <View style={[styles.middleRing, isGlowing && styles.middleRingGlow]}>
          <View style={[styles.coreOrb, isGlowing && styles.coreOrbGlow]} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  outerRing: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
    borderColor: Colors.hudCyanDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRingGlow: {
    borderColor: Colors.hudCyan,
  },
  middleRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: Colors.hudBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middleRingGlow: {
    borderColor: Colors.hudCyan,
  },
  coreOrb: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.hudCyanDim,
    borderWidth: 2,
    borderColor: Colors.hudCyan,
  },
  coreOrbGlow: {
    backgroundColor: Colors.hudCyan,
  },
});
