import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { AssistantScreen } from '../screens/AssistantScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MemoryManagerScreen } from '../screens/MemoryManagerScreen';
import { DebugTelemetryScreen } from '../screens/DebugTelemetryScreen';

const Stack = createStackNavigator();

export const AppNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Assistant" component={AssistantScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="MemoryManager" component={MemoryManagerScreen} />
      <Stack.Screen name="DebugTelemetry" component={DebugTelemetryScreen} />
    </Stack.Navigator>
  );
};
