import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../app/theme';
import { Header } from '../components/Header';
import { HolographicOrb } from '../components/HolographicOrb';
import { StatusBanner } from '../components/StatusBanner';
import { VoiceWaveform } from '../components/VoiceWaveform';
import { ActionStreamCard } from '../components/ActionStreamCard';
import { useAgentStore } from '../state/agentStore';
import { useVoiceStore } from '../state/voiceStore';
import { VoicePipeline } from '../voice/voicePipeline';
import { FridayAgent } from '../agent/agent';

export const AssistantScreen: React.FC<any> = ({ navigation }) => {
  const agentState = useAgentStore((s) => s.state);
  const activeGoal = useAgentStore((s) => s.activeGoal);
  const steps = useAgentStore((s) => s.steps);
  const lastResponse = useAgentStore((s) => s.lastResponse);
  const rmsLevel = useVoiceStore((s) => s.rmsLevel);
  const transcriptStream = useVoiceStore((s) => s.transcriptStream);

  const handleOrbPress = async () => {
    const agent = new FridayAgent();
    await VoicePipeline.handleVoiceTurn(async (goal) => {
      return await agent.executeGoal(goal);
    });
  };

  return (
    <View style={styles.container}>
      <Header
        title="FRIDAY"
        onNavigateSettings={() => navigation.navigate('Settings')}
        onNavigateTelemetry={() => navigation.navigate('DebugTelemetry')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <StatusBanner state={agentState} />
        
        <HolographicOrb state={agentState} onPress={handleOrbPress} />
        
        <VoiceWaveform rmsLevel={rmsLevel} isActive={agentState === 'LISTENING'} />

        {transcriptStream ? (
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptLabel}>VOICE TRANSCRIPT</Text>
            <Text style={styles.transcriptText}>{transcriptStream}</Text>
          </View>
        ) : null}

        {activeGoal ? (
          <View style={styles.goalBox}>
            <Text style={styles.goalLabel}>ACTIVE TASK</Text>
            <Text style={styles.goalText}>{activeGoal}</Text>
          </View>
        ) : null}

        {steps.length > 0 && (
          <View style={styles.streamSection}>
            <Text style={styles.sectionHeader}>ACTION EXECUTION STREAM</Text>
            {steps.map((st) => (
              <ActionStreamCard key={st.id} step={st} />
            ))}
          </View>
        )}

        {lastResponse && (
          <View style={styles.responseBox}>
            <Text style={styles.responseLabel}>FRIDAY RESPONSE</Text>
            <Text style={styles.responseText}>{lastResponse}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  transcriptBox: {
    backgroundColor: Colors.cardBackground,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.hudCyanDim,
    marginVertical: 8,
  },
  transcriptLabel: {
    color: Colors.hudCyan,
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  transcriptText: {
    color: Colors.textPrimary,
    fontSize: 14,
  },
  goalBox: {
    backgroundColor: Colors.cardBackground,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 12,
  },
  goalLabel: {
    color: Colors.textDim,
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  goalText: {
    color: Colors.textPrimary,
    fontSize: 13,
  },
  streamSection: {
    marginVertical: 12,
  },
  sectionHeader: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  responseBox: {
    backgroundColor: Colors.cardBackground,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.hudGreen,
    marginTop: 12,
  },
  responseLabel: {
    color: Colors.hudGreen,
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  responseText: {
    color: Colors.textPrimary,
    fontSize: 14,
  },
});
