import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Colors } from '../app/theme';
import { MemoryStore } from '../memory/store';

export const MemoryManagerScreen: React.FC = () => {
  const profile = MemoryStore.getProfile();
  const facts = MemoryStore.getAllFacts();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>STRUCTURED MEMORY HUB</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>User Profile</Text>
        <Text style={styles.cardValue}>Name: {profile.name} ({profile.nickname})</Text>
        <Text style={styles.cardValue}>Music: {profile.preferredMusicApp}</Text>
      </View>

      <Text style={[styles.header, { marginTop: 16 }]}>STORED FACTS</Text>
      {facts.map((fact) => (
        <View key={fact.id} style={styles.card}>
          <Text style={styles.cardTitle}>{fact.key}</Text>
          <Text style={styles.cardValue}>{fact.value}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  header: { color: Colors.hudCyan, fontSize: 14, fontWeight: 'bold', letterSpacing: 1.2, marginBottom: 12 },
  card: { backgroundColor: Colors.cardBackground, borderRadius: 8, borderWidth: 1, borderColor: Colors.cardBorder, padding: 12, marginBottom: 8 },
  cardTitle: { color: Colors.hudCyan, fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  cardValue: { color: Colors.textSecondary, fontSize: 12 },
});
