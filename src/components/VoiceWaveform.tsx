import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '../app/theme';
import { useVoiceStore } from '../state/voiceStore';
import { useAgentStore } from '../state/agentStore';

interface Props {
  rmsLevel?: number;
  isActive?: boolean;
}

const BAR_COUNT = 15;

export const VoiceWaveform: React.FC<Props> = ({ rmsLevel: propRms, isActive: propIsActive }) => {
  const storeRms = useVoiceStore((s) => s.rmsLevel);
  const isSpeaking = useVoiceStore((s) => s.isSpeaking);
  const agentState = useAgentStore((s) => s.state);

  const rms = propRms !== undefined ? propRms : storeRms;
  const isActive =
    propIsActive !== undefined
      ? propIsActive
      : agentState === 'LISTENING' || agentState === 'SPEAKING' || isSpeaking;

  const animValues = useRef(Array.from({ length: BAR_COUNT }, () => new Animated.Value(4))).current;
  const smoothedRms = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const rmsRef = useRef(rms);
  rmsRef.current = rms;
  const isSpeakingRef = useRef(isSpeaking || agentState === 'SPEAKING');
  isSpeakingRef.current = isSpeaking || agentState === 'SPEAKING';

  useEffect(() => {
    let isMounted = true;

    if (!isActive) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      smoothedRms.current = 0;
      animValues.forEach((val, i) => {
        const idleHeight = 4 + Math.sin((i / (BAR_COUNT - 1)) * Math.PI) * 2;
        val.setValue(idleHeight);
      });
      return;
    }

    // Continuous 60fps dynamic animation loop when active (Listening or Speaking)
    const animateLoop = () => {
      if (!isMounted) return;

      const time = Date.now();
      const isFridaySpeaking = isSpeakingRef.current;

      // 1. Calculate energy: from incoming mic RMS (Listening) or simulated speech wave (Speaking)
      let energy = 0;
      if (isFridaySpeaking) {
        energy = 0.35 + Math.sin(time / 140) * 0.25 + Math.cos(time / 80) * 0.15;
      } else {
        const normalizedRms = Math.min(1.0, Math.max(0.0, (rmsRef.current || 0) / 8.0));
        smoothedRms.current = 0.65 * smoothedRms.current + 0.35 * normalizedRms;
        energy = smoothedRms.current;
      }

      // 2. Apply envelope and wave calculation across bars with direct setValue for zero GC overhead
      animValues.forEach((val, i) => {
        const centerDist = Math.abs(i - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2);
        const envelope = Math.cos(centerDist * (Math.PI / 2));

        const wavePhase = time / 180 + i * 0.45;
        const idleBreathing = 4 + Math.sin(wavePhase) * (isFridaySpeaking ? 5 : 2.5);
        const voiceHeight = envelope * energy * (isFridaySpeaking ? 36 : 48);
        const targetHeight = Math.max(4, Math.min(52, idleBreathing + voiceHeight));

        val.setValue(targetHeight);
      });

      animFrameRef.current = requestAnimationFrame(animateLoop);
    };

    animFrameRef.current = requestAnimationFrame(animateLoop);

    return () => {
      isMounted = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isActive]);

  return (
    <View style={styles.container}>
      {animValues.map((animHeight, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              height: animHeight,
              backgroundColor: isActive
                ? agentState === 'SPEAKING' || isSpeaking
                  ? Colors.hudGreen
                  : Colors.hudCyan
                : Colors.textDim,
              opacity: isActive ? 0.95 : 0.35,
              shadowColor: isActive
                ? agentState === 'SPEAKING' || isSpeaking
                  ? Colors.hudGreen
                  : Colors.hudCyan
                : 'transparent',
              shadowOpacity: isActive ? 0.8 : 0,
              shadowRadius: 5,
              elevation: isActive ? 4 : 0,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    gap: 4.5,
    marginVertical: 8,
  },
  bar: {
    width: 3.5,
    borderRadius: 2,
  },
});
