import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ScrollView,
  Keyboard,
} from 'react-native';
import { Colors } from '../app/theme';

interface Props {
  onSendMessage: (text: string) => void;
  onStartVoice: () => void;
  isListening: boolean;
  disabled?: boolean;
}

const CONTEXT_SUGGESTIONS = [
  { label: "What's on screen?", prompt: "What is currently on my screen?" },
  { label: "Play music", prompt: "Play some relaxing music" },
  { label: "Check reminders", prompt: "Tell me what reminders I have set" },
  { label: "Read notifications", prompt: "Read my latest notifications" },
  { label: "Mute volume", prompt: "Mute device media volume" },
  { label: "Toggle flashlight", prompt: "Toggle flashlight" },
];

export const UniversalComposer: React.FC<Props> = ({
  onSendMessage,
  onStartVoice,
  isListening,
  disabled = false,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = () => {
    const trimmed = inputText.trim();
    if (!trimmed || disabled) return;
    setInputText('');
    Keyboard.dismiss();
    onSendMessage(trimmed);
  };

  const handleSuggestionPress = (prompt: string) => {
    if (disabled) return;
    onSendMessage(prompt);
  };

  return (
    <View style={styles.container}>
      {/* Contextual Action Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.suggestionsList}
      >
        {CONTEXT_SUGGESTIONS.map((item, index) => (
          <TouchableOpacity
            key={index}
            activeOpacity={0.7}
            style={styles.suggestionPill}
            onPress={() => handleSuggestionPress(item.prompt)}
          >
            <Text style={styles.suggestionText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Main Composer Bar */}
      <View style={styles.composerBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask FRIDAY or type command..."
          placeholderTextColor="#4A5B78"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
          editable={!disabled}
        />

        {inputText.trim().length > 0 ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSubmit}
            style={[styles.actionButton, styles.sendButton]}
          >
            <Text style={styles.sendIcon}>➔</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onStartVoice}
            style={[
              styles.actionButton,
              styles.micButton,
              isListening && styles.micButtonActive,
            ]}
          >
            <Text style={[styles.micIcon, isListening && styles.micIconActive]}>
              {isListening ? '●' : '🎙'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 6,
    backgroundColor: 'transparent',
  },
  suggestionsList: {
    paddingBottom: 10,
    gap: 8,
  },
  suggestionPill: {
    backgroundColor: 'rgba(13, 21, 39, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
  },
  suggestionText: {
    color: '#8B9BB4',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 21, 39, 0.9)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.35)',
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'monospace',
    paddingVertical: 10,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  micButton: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    borderWidth: 1,
    borderColor: Colors.hudCyan,
  },
  micButtonActive: {
    backgroundColor: Colors.hudRed,
    borderColor: '#FF3366',
  },
  sendButton: {
    backgroundColor: Colors.hudCyan,
  },
  micIcon: {
    fontSize: 18,
    color: Colors.hudCyan,
  },
  micIconActive: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  sendIcon: {
    fontSize: 16,
    color: '#070B14',
    fontWeight: '700',
  },
});
