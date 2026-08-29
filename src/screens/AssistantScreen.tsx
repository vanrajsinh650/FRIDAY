import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Colors } from '../app/theme';
import { Header } from '../components/Header';
import { HolographicOrb } from '../components/HolographicOrb';
import { UniversalComposer } from '../components/UniversalComposer';
import { HolographicMediaWidget } from '../components/HolographicMediaWidget';
import { HolographicTaskTimeline } from '../components/HolographicTaskTimeline';
import { HolographicAppDrawer } from '../components/HolographicAppDrawer';
import { UpdateModal } from '../components/UpdateModal';
import { AppActionModal } from '../components/AppActionModal';
import { useAgentStore } from '../state/agentStore';
import { useVoiceStore } from '../state/voiceStore';
import { VoicePipeline } from '../voice/voicePipeline';
import { FridayAgent } from '../agent/agent';
import { SystemControlModule } from '../native/SystemControlModule';
import { AccessibilityModule } from '../native/AccessibilityModule';
import { InstalledApp } from '../native/types';
import { InAppUpdateService } from '../services/InAppUpdateService';

export const AssistantScreen: React.FC<any> = ({ navigation }) => {
  const agentState = useAgentStore((s) => s.state);
  const activeGoal = useAgentStore((s) => s.activeGoal);
  const steps = useAgentStore((s) => s.steps);
  const lastResponse = useAgentStore((s) => s.lastResponse);
  const errorMessage = useAgentStore((s) => s.errorMessage);
  const transcriptStream = useVoiceStore((s) => s.transcriptStream);
  const isListening = useVoiceStore((s) => s.isAssistantEnabled && agentState === 'LISTENING');

  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMediaPlaying, setIsMediaPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  const agent = React.useMemo(() => new FridayAgent(), []);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setCurrentDate(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadInstalledApps = async () => {
    try {
      const installed = await SystemControlModule.getInstalledApps();
      const sorted = installed.sort((a, b) => a.appName.localeCompare(b.appName));
      setApps(sorted);
    } catch (_e) {}
  };

  useEffect(() => {
    loadInstalledApps();
    VoicePipeline.initializeWakeWordListener();
    InAppUpdateService.initialize().then(() => {
      InAppUpdateService.checkForUpdates(true).catch(() => {});
    });
  }, []);

  const handleOrbPress = async () => {
    if (agentState === 'EXECUTING') {
      useAgentStore.getState().setAgentState('IDLE');
      return;
    }
    await VoicePipeline.startVoiceSession();
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    try {
      await agent.executeGoal(text);
    } catch (e: any) {
      useAgentStore.getState().setError(e.message || 'Execution error');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Top Holographic Navigation Header */}
      <Header
        onSettingsPress={() => navigation.navigate('Settings')}
        onMemoryPress={() => navigation.navigate('Memory')}
      />

      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.mainContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Holographic Time & Date Display */}
        <View style={styles.clockContainer}>
          <Text style={styles.clockText}>{currentTime}</Text>
          <Text style={styles.dateText}>{currentDate.toUpperCase()}</Text>
        </View>

        {/* Central Holographic Core */}
        <HolographicOrb state={agentState} onPress={handleOrbPress} />

        {/* Dynamic Holographic Subtitle / Live Stream */}
        <View style={styles.statusBox}>
          {agentState === 'IDLE' && (
            <Text style={styles.idleGreeting}>FRIDAY ONLINE // AWAITING COMMAND, BOSS.</Text>
          )}

          {agentState === 'LISTENING' && (
            <Text style={styles.listeningText}>
              {transcriptStream ? `"${transcriptStream}"` : 'Listening to voice...'}
            </Text>
          )}

          {(agentState === 'THINKING' || agentState === 'PLANNING') && (
            <Text style={styles.thinkingText}>
              REASONING & GROUNDING LIVE WORLD STATE...
            </Text>
          )}

          {agentState === 'VERIFYING' && (
            <Text style={styles.verifyingText}>
              VERIFYING PHYSICAL OUTCOME ON DEVICE...
            </Text>
          )}

          {lastResponse && agentState !== 'EXECUTING' && agentState !== 'LISTENING' && (
            <View style={styles.responseContainer}>
              <Text style={styles.responseText}>"{lastResponse}"</Text>
            </View>
          )}

          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠ {errorMessage}</Text>
            </View>
          )}
        </View>

        {/* Contextual Task Execution Timeline (Visible only during active task) */}
        {agentState === 'EXECUTING' && (
          <HolographicTaskTimeline
            goal={activeGoal || 'Executing operation...'}
            steps={steps}
          />
        )}

        {/* Contextual Media Player Bar (Visible when media is playing or requested) */}
        {isMediaPlaying && (
          <HolographicMediaWidget
            title="Audio Playback Stream"
            source="Media Engine"
            isPlaying={isMediaPlaying}
            onTogglePlay={() => setIsMediaPlaying(!isMediaPlaying)}
          />
        )}
      </ScrollView>

      {/* Quick Dock & Collapsible App Drawer */}
      <HolographicAppDrawer
        apps={apps}
        isOpen={drawerOpen}
        onToggle={() => setDrawerOpen(!drawerOpen)}
      />

      {/* Universal Interaction Composer (Voice + Text + Contextual Pills) */}
      <UniversalComposer
        onSendMessage={handleSendMessage}
        onStartVoice={handleOrbPress}
        isListening={isListening}
        disabled={agentState === 'EXECUTING'}
      />

      {/* In-App Update Modal & App Management Modal */}
      <UpdateModal />
      <AppActionModal />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mainScrollView: {
    flex: 1,
  },
  mainContent: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  clockContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  clockText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 2,
  },
  dateText: {
    color: 'rgba(0, 240, 255, 0.7)',
    fontSize: 11,
    fontFamily: 'monospace',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  statusBox: {
    paddingHorizontal: 24,
    alignItems: 'center',
    marginVertical: 10,
    minHeight: 40,
  },
  idleGreeting: {
    color: '#8B9BB4',
    fontSize: 11,
    fontFamily: 'monospace',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  listeningText: {
    color: Colors.hudCyan,
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '600',
    textAlign: 'center',
  },
  thinkingText: {
    color: Colors.hudBlue,
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  verifyingText: {
    color: '#00E5FF',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  responseContainer: {
    backgroundColor: 'rgba(13, 21, 39, 0.8)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
    maxWidth: '90%',
  },
  responseText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'monospace',
    textAlign: 'center',
    lineHeight: 18,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 51, 102, 0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.hudRed,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  errorText: {
    color: Colors.hudRed,
    fontSize: 11,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
});
