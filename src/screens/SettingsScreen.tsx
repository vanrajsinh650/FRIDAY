import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Colors } from '../app/theme';
import { useSettingsStore } from '../state/settingsStore';

export const SettingsScreen: React.FC = () => {
  const settings = useSettingsStore();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>SYSTEM SETTINGS</Text>

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
        <Text style={styles.cardValue}>STT: Sherpa-ONNX Streaming</Text>
        <Text style={styles.cardValue}>TTS: Pocket-TTS (CPU Native)</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  header: { color: Colors.hudCyan, fontSize: 16, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 16 },
  card: { backgroundColor: Colors.cardBackground, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, padding: 14, marginBottom: 12 },
  cardTitle: { color: Colors.hudCyan, fontSize: 13, fontWeight: 'bold', marginBottom: 6 },
  cardValue: { color: Colors.textSecondary, fontSize: 12, marginBottom: 2 },
});
