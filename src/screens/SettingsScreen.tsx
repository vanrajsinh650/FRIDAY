import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { Colors } from '../app/theme';
import { useSettingsStore } from '../state/settingsStore';
import { useUpdateStore } from '../state/updateStore';
import { InAppUpdateService } from '../services/InAppUpdateService';
import { UpdateModal } from '../components/UpdateModal';

export const SettingsScreen: React.FC = () => {
  const settings = useSettingsStore();
  const updateStatus = useUpdateStore((s) => s.status);
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const currentVersionCode = useUpdateStore((s) => s.currentVersionCode);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const [checking, setChecking] = useState(false);

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      await InAppUpdateService.checkForUpdates(false);
    } finally {
      setChecking(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>SYSTEM SETTINGS</Text>

      {/* In-App System Updates Card */}
      <View style={[styles.card, styles.updateCard]}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>🚀 In-App System Updates</Text>
          <View style={styles.versionTag}>
            <Text style={styles.versionTagText}>v{currentVersion} ({currentVersionCode})</Text>
          </View>
        </View>

        <Text style={styles.cardValue}>
          Status: {updateStatus === 'CHECKING' || checking ? 'Checking for updates...' : updateStatus === 'AVAILABLE' ? `New update available: v${latestVersion}` : updateStatus === 'UP_TO_DATE' ? 'Up to date with latest version' : 'Idle'}
        </Text>

        <View style={styles.updateActionRow}>
          <TouchableOpacity
            style={[styles.checkUpdateBtn, checking && styles.checkUpdateBtnDisabled]}
            disabled={checking}
            onPress={handleCheckUpdate}
          >
            {checking ? (
              <View style={styles.btnRow}>
                <ActivityIndicator size="small" color="#000" />
                <Text style={styles.checkUpdateBtnText}> CHECKING...</Text>
              </View>
            ) : (
              <Text style={styles.checkUpdateBtnText}>CHECK FOR UPDATES</Text>
            )}
          </TouchableOpacity>

          {updateStatus === 'AVAILABLE' && (
            <TouchableOpacity
              style={styles.openUpdateBtn}
              onPress={() => useUpdateStore.getState().setModalVisible(true)}
            >
              <Text style={styles.openUpdateBtnText}>VIEW UPDATE</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Model Provider</Text>
        <Text style={styles.cardValue}>Active: {settings.defaultModelProvider.toUpperCase()}</Text>
        <Text style={styles.cardValue}>Model: {settings.modelName}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>VPS Brain Server</Text>
        <Text style={styles.cardValue}>{settings.vpsServerUrl}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Speech Engines</Text>
        <Text style={styles.cardValue}>STT: Sherpa-ONNX / Whisper Streaming</Text>
        <Text style={styles.cardValue}>TTS: Pocket-TTS (CPU Native)</Text>
      </View>

      <UpdateModal />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  header: { color: Colors.hudCyan, fontSize: 16, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 16 },
  card: { backgroundColor: Colors.cardBackground, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, padding: 14, marginBottom: 12 },
  updateCard: { borderColor: Colors.hudCyan, backgroundColor: 'rgba(0, 229, 255, 0.05)' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { color: Colors.hudCyan, fontSize: 13, fontWeight: 'bold' },
  cardValue: { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  versionTag: { backgroundColor: Colors.hudCyanDim, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: Colors.hudCyan },
  versionTagText: { color: Colors.hudCyan, fontSize: 11, fontWeight: 'bold' },
  updateActionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  checkUpdateBtn: { flex: 1, backgroundColor: Colors.hudCyan, paddingVertical: 8, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  checkUpdateBtnDisabled: { opacity: 0.7 },
  checkUpdateBtnText: { color: '#000', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
  openUpdateBtn: { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderWidth: 1, borderColor: '#10b981', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  openUpdateBtnText: { color: '#10b981', fontSize: 11, fontWeight: 'bold' },
  btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
