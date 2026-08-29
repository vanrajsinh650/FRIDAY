import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Easing, Text } from 'react-native';
import { Colors } from '../app/theme';
import { AgentState } from '../state/agentStore';

interface Props {
  state: AgentState;
  onPress: () => void;
}

export const HolographicOrb: React.FC<Props> = ({ state, onPress }) => {
  const isIdle = state === 'IDLE';
  const isListening = state === 'LISTENING';
  const isThinking = state === 'THINKING' || state === 'PLANNING';
  const isExecuting = state === 'EXECUTING';
  const isVerifying = state === 'VERIFYING';
  const isSpeakingOrSuccess = state === 'SPEAKING' || state === 'SUCCESS';
  const isError = state === 'ERROR';

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const outerRotateAnim = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // Pulse animation
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: isListening || isExecuting ? 1.12 : isThinking ? 1.06 : 1.03,
          duration: isListening ? 600 : isThinking ? 800 : 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.97,
          duration: isListening ? 600 : isThinking ? 800 : 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Inner ring rotation
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: isThinking ? 3000 : isExecuting ? 4000 : 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Outer ring counter-rotation
    const outerRotateLoop = Animated.loop(
      Animated.timing(outerRotateAnim, {
        toValue: 1,
        duration: isThinking ? 4500 : isExecuting ? 6000 : 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Glow breathing
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: isListening || isExecuting || isSpeakingOrSuccess ? 0.9 : 0.45,
          duration: isListening ? 500 : 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.25,
          duration: isListening ? 500 : 1500,
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    rotateLoop.start();
    outerRotateLoop.start();
    glowLoop.start();

    return () => {
      pulseLoop.stop();
      rotateLoop.stop();
      outerRotateLoop.stop();
      glowLoop.stop();
    };
  }, [state, isListening, isThinking, isExecuting, isSpeakingOrSuccess]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const counterSpin = outerRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  let primaryColor = Colors.hudCyan;
  let coreBg = 'rgba(0, 240, 255, 0.15)';
  let stateGlyph = 'FRIDAY';

  if (isListening) {
    primaryColor = Colors.hudCyan;
    coreBg = 'rgba(0, 240, 255, 0.35)';
    stateGlyph = 'LISTENING';
  } else if (isThinking) {
    primaryColor = Colors.hudBlue;
    coreBg = 'rgba(0, 119, 254, 0.3)';
    stateGlyph = 'PROCESSING';
  } else if (isExecuting) {
    primaryColor = Colors.hudOrange;
    coreBg = 'rgba(255, 136, 0, 0.3)';
    stateGlyph = 'EXECUTING';
  } else if (isVerifying) {
    primaryColor = '#00E5FF';
    coreBg = 'rgba(0, 229, 255, 0.25)';
    stateGlyph = 'VERIFYING';
  } else if (isSpeakingOrSuccess) {
    primaryColor = Colors.hudGreen;
    coreBg = 'rgba(0, 255, 136, 0.3)';
    stateGlyph = state === 'SPEAKING' ? 'SPEAKING' : 'ONLINE';
  } else if (isError) {
    primaryColor = Colors.hudRed;
    coreBg = 'rgba(255, 51, 102, 0.3)';
    stateGlyph = 'ALERT';
  }

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.touchContainer}>
      <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
        {/* Outer Halo Glow */}
        <Animated.View
          style={[
            styles.haloGlow,
            {
              backgroundColor: primaryColor,
              opacity: glowOpacity,
            },
          ]}
        />

        {/* Outer Tech Gyro Ring */}
        <Animated.View
          style={[
            styles.outerRing,
            {
              borderColor: primaryColor,
              transform: [{ rotate: counterSpin }],
            },
          ]}
        >
          <View style={[styles.markerTick, { backgroundColor: primaryColor, top: -4 }]} />
          <View style={[styles.markerTick, { backgroundColor: primaryColor, bottom: -4 }]} />
          <View style={[styles.markerTick, { backgroundColor: primaryColor, left: -4 }]} />
          <View style={[styles.markerTick, { backgroundColor: primaryColor, right: -4 }]} />
        </Animated.View>

        {/* Middle Rotating HUD Arc */}
        <Animated.View
          style={[
            styles.middleRing,
            {
              borderTopColor: primaryColor,
              borderRightColor: 'transparent',
              borderBottomColor: primaryColor,
              borderLeftColor: 'transparent',
              transform: [{ rotate: spin }],
            },
          ]}
        />

        {/* Inner Geometric Shield */}
        <View
          style={[
            styles.innerRing,
            {
              borderColor: primaryColor,
            },
          ]}
        />

        {/* Holographic Center Core */}
        <View
          style={[
            styles.coreOrb,
            {
              backgroundColor: coreBg,
              borderColor: primaryColor,
            },
          ]}
        >
          <View style={[styles.centerPoint, { backgroundColor: primaryColor }]} />
          <Text style={[styles.glyphText, { color: primaryColor }]}>{stateGlyph}</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
  },
  container: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloGlow: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
  },
  outerRing: {
    position: 'absolute',
    width: 196,
    height: 196,
    borderRadius: 98,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerTick: {
    position: 'absolute',
    width: 8,
    height: 3,
    borderRadius: 1,
  },
  middleRing: {
    position: 'absolute',
    width: 154,
    height: 154,
    borderRadius: 77,
    borderWidth: 2,
  },
  innerRing: {
    position: 'absolute',
    width: 122,
    height: 122,
    borderRadius: 61,
    borderWidth: 1,
    borderStyle: 'dotted',
    opacity: 0.6,
  },
  coreOrb: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPoint: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  glyphText: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});
