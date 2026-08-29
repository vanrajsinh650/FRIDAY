import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
} from 'react-native';
import { Colors } from '../app/theme';
import { InstalledApp } from '../native/types';
import { SystemControlModule } from '../native/SystemControlModule';
import { useLauncherStore } from '../state/launcherStore';
import { AppCategorizer, AppCategoryKey, APP_CATEGORIES } from '../utils/appCategorizer';

interface Props {
  apps: InstalledApp[];
  isOpen: boolean;
  onToggle: () => void;
}

export const HolographicAppDrawer: React.FC<Props> = ({
  apps,
  isOpen,
  onToggle,
}) => {
  const [search, setSearch] = useState('');
  const pinnedPackages = useLauncherStore((s) => s.pinnedPackages);
  const hiddenPackages = useLauncherStore((s) => s.hiddenPackages);
  const selectedCategory = useLauncherStore((s) => s.selectedCategory);
  const setSelectedCategory = useLauncherStore((s) => s.setSelectedCategory);
  const setSelectedAppForAction = useLauncherStore((s) => s.setSelectedAppForAction);

  const visibleApps = apps.filter((a) => !hiddenPackages.includes(a.packageName));

  const filteredApps = visibleApps.filter((app) => {
    const matchesSearch = app.appName.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedCategory === 'ALL') return true;
    if (selectedCategory === 'FAVORITES') return pinnedPackages.includes(app.packageName);

    const cat = AppCategorizer.categorizeApp(app.appName, app.packageName);
    return cat === selectedCategory;
  });

  const handleLaunch = async (pkg: string) => {
    await SystemControlModule.launchApp(pkg).catch(() => {});
  };

  return (
    <View style={styles.container}>
      {/* Quick Access Pinned Dock */}
      <View style={styles.dockContainer}>
        <View style={styles.dockRow}>
          {apps
            .filter((a) => pinnedPackages.includes(a.packageName))
            .slice(0, 5)
            .map((app) => (
              <TouchableOpacity
                key={app.packageName}
                activeOpacity={0.7}
                onPress={() => handleLaunch(app.packageName)}
                onLongPress={() => setSelectedAppForAction(app)}
                style={styles.dockItem}
              >
                {app.icon ? (
                  <Image source={{ uri: `data:image/png;base64,${app.icon}` }} style={styles.dockIcon} />
                ) : (
                  <View style={styles.dockIconPlaceholder}>
                    <Text style={styles.dockIconText}>{app.appName.charAt(0)}</Text>
                  </View>
                )}
                <Text numberOfLines={1} style={styles.dockLabel}>
                  {app.appName}
                </Text>
              </TouchableOpacity>
            ))}

          <TouchableOpacity activeOpacity={0.8} onPress={onToggle} style={styles.drawerToggleBtn}>
            <Text style={styles.toggleIcon}>{isOpen ? '▼' : '▲'}</Text>
            <Text style={styles.toggleText}>{isOpen ? 'CLOSE' : 'APPS'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Expanded Full Drawer */}
      {isOpen && (
        <View style={styles.expandedDrawer}>
          {/* Search Input */}
          <TextInput
            style={styles.searchInput}
            placeholder="Search installed apps..."
            placeholderTextColor="#4A5B78"
            value={search}
            onChangeText={setSearch}
          />

          {/* Category Chips */}
          <View style={styles.categoriesRow}>
            {APP_CATEGORIES.slice(0, 6).map((cat) => (
              <TouchableOpacity
                key={cat.key}
                activeOpacity={0.7}
                onPress={() => setSelectedCategory(cat.key as AppCategoryKey)}
                style={[
                  styles.categoryChip,
                  selectedCategory === cat.key && styles.categoryChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === cat.key && styles.categoryTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* App Grid */}
          <FlatList
            data={filteredApps}
            keyExtractor={(item) => item.packageName}
            numColumns={4}
            contentContainerStyle={styles.appList}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleLaunch(item.packageName)}
                onLongPress={() => setSelectedAppForAction(item)}
                style={styles.appGridItem}
              >
                {item.icon ? (
                  <Image source={{ uri: `data:image/png;base64,${item.icon}` }} style={styles.appIcon} />
                ) : (
                  <View style={styles.appIconPlaceholder}>
                    <Text style={styles.appIconText}>{item.appName.charAt(0)}</Text>
                  </View>
                )}
                <Text numberOfLines={1} style={styles.appName}>
                  {item.appName}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  dockContainer: {
    backgroundColor: 'rgba(13, 21, 39, 0.75)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  dockItem: {
    alignItems: 'center',
    width: 54,
  },
  dockIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    marginBottom: 4,
  },
  dockIconPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 240, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dockIconText: {
    color: Colors.hudCyan,
    fontSize: 16,
    fontWeight: '700',
  },
  dockLabel: {
    color: '#8B9BB4',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  drawerToggleBtn: {
    alignItems: 'center',
    width: 50,
  },
  toggleIcon: {
    color: Colors.hudCyan,
    fontSize: 16,
    marginBottom: 2,
  },
  toggleText: {
    color: Colors.hudCyan,
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  expandedDrawer: {
    backgroundColor: 'rgba(7, 11, 20, 0.95)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.35)',
    padding: 12,
    marginTop: 8,
    maxHeight: 280,
  },
  searchInput: {
    backgroundColor: 'rgba(13, 21, 39, 0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'monospace',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  categoryChip: {
    backgroundColor: 'rgba(13, 21, 39, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryChipActive: {
    borderColor: Colors.hudCyan,
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
  },
  categoryText: {
    color: '#8B9BB4',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  categoryTextActive: {
    color: Colors.hudCyan,
    fontWeight: '700',
  },
  appList: {
    paddingBottom: 8,
  },
  appGridItem: {
    flex: 1 / 4,
    alignItems: 'center',
    marginBottom: 12,
  },
  appIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginBottom: 4,
  },
  appIconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  appIconText: {
    color: Colors.hudCyan,
    fontSize: 14,
    fontWeight: '700',
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'monospace',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
});
