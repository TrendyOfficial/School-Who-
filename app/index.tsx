

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Switch,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";

interface GameSettings {
  theme: "light" | "dark";
  language: string;
  trollMode: boolean;
  timerEnabled: boolean;
  timerDuration: number;
  numberOfImposters: number;
  wordsPerRound: number;
}

interface Player {
  _id: Id<"players">;
  name: string;
  color: string;
  index: number;
}

const PLAYER_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"
];

export default function GameLobby() {
  const [gameId, setGameId] = useState<Id<"games"> | null>(null);
  const [settings, setSettings] = useState<GameSettings>({
    theme: "light",
    language: "NL",
    trollMode: false,
    timerEnabled: true,
    timerDuration: 300, // 5 minutes
    numberOfImposters: 1,
    wordsPerRound: 10,
  });
  
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");

  // Convex hooks
  const createGame = useMutation(api.games.createGame);
  const addPlayer = useMutation(api.players.addPlayer);
  const updatePlayer = useMutation(api.players.updatePlayer);
  const removePlayer = useMutation(api.players.removePlayer);
  const updateGameSettings = useMutation(api.games.updateGameSettings);
  const updateSelectedCategories = useMutation(api.games.updateSelectedCategories);
  const startGame = useMutation(api.games.startGame);
  const initializeCategories = useMutation(api.categories.initializeCategories);
  
  const game = useQuery(api.games.getGame, gameId ? { gameId } : "skip");
  const players = useQuery(api.players.getPlayers, gameId ? { gameId } : "skip");
  const categories = useQuery(api.categories.getCategories, {});

  // Initialize game on mount
  useEffect(() => {
    const initGame = async () => {
      try {
        await initializeCategories();
        const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const newGameId = await createGame({ gameCode, settings });
        setGameId(newGameId);
        
        // Add default players
        const defaultPlayers = ["Speler 1", "Speler 2", "Speler 3"];
        for (let i = 0; i < defaultPlayers.length; i++) {
          await addPlayer({
            gameId: newGameId,
            name: defaultPlayers[i],
            color: PLAYER_COLORS[i],
          });
        }
      } catch (error) {
        console.error("Failed to initialize game:", error);
        Alert.alert("Error", "Failed to create game");
      }
    };
    
    if (!gameId) {
      initGame();
    }
  }, []);

  const handleAddPlayer = async () => {
    if (!gameId || !players) return;
    
    const playerName = `Speler ${players.length + 1}`;
    const colorIndex = players.length % PLAYER_COLORS.length;
    
    try {
      await addPlayer({
        gameId,
        name: playerName,
        color: PLAYER_COLORS[colorIndex],
      });
      
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to add player");
    }
  };

  const handlePlayerPress = (player: Player) => {
    setSelectedPlayer(player);
    setNewPlayerName(player.name);
    setShowPlayerModal(true);
  };

  const handleUpdatePlayer = async () => {
    if (!selectedPlayer) return;
    
    try {

      await updatePlayer({
        playerId: selectedPlayer._id,
        name: newPlayerName,
      });
      setShowPlayerModal(false);
      setSelectedPlayer(null);
      
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update player");
    }
  };

  const handleRemovePlayer = async () => {
    if (!selectedPlayer || !players) return;
    
    if (players.length <= 3) {
      Alert.alert("Error", "Need at least 3 players");
      return;
    }
    
    try {
      await removePlayer({ playerId: selectedPlayer._id });
      setShowPlayerModal(false);
      setSelectedPlayer(null);
      
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to remove player");
    }
  };

  const handleCategoryToggle = (categoryName: string) => {
    const newSelection = selectedCategories.includes(categoryName)
      ? selectedCategories.filter(c => c !== categoryName)
      : [...selectedCategories, categoryName];
    
    setSelectedCategories(newSelection);
    
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleStartGame = async () => {
    if (!gameId) return;
    
    if (selectedCategories.length === 0) {
      Alert.alert("Error", "Selecteer minimaal één categorie");
      return;
    }
    
    try {
      await updateSelectedCategories({ gameId, categories: selectedCategories });
      await startGame({ gameId });
      
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      
      router.push(`/game/${gameId}`);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to start game");
    }
  };

  const isDarkTheme = settings.theme === "dark";
  const themeStyles = isDarkTheme ? darkStyles : lightStyles;

  return (
    <
SafeAreaView style={[styles.container, themeStyles.container]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, themeStyles.text]}>Imposter Game</Text>
          <TouchableOpacity
            style={[styles.settingsButton, themeStyles.button]}
            onPress={() => setShowSettingsModal(true)}
          >
            <Text style={[styles.buttonText, themeStyles.buttonText]}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Players Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, themeStyles.text]}>👥 Spelers</Text>
          <View style={styles.playersList}>
            {players?.map((player) => (
              <TouchableOpacity
                key={player._id}
                style={[styles.playerItem, { backgroundColor: player.color + "20" }]}
                onPress={() => handlePlayerPress(player)}
              >
                <View style={[styles.playerColor, { backgroundColor: player.color }]} />
                <Text style={[styles.playerName, themeStyles.text]}>{player.name}</Text>
                <Text style={styles.playerEdit}>✏️</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.addPlayerButton, themeStyles.button]}
              onPress={handleAddPlayer}
            >
              <Text style={[styles.addPlayerText, themeStyles.buttonText]}>+ Speler toevoegen</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Categories Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, themeStyles.text]}>📂 Categorieën</Text>
          <TouchableOpacity
            style={[styles.categoriesButton, themeStyles.button]}
            onPress={() => setShowCategoriesModal(true)}
          >
            <Text style={[styles.buttonText, themeStyles.buttonText]}>
      
        {selectedCategories.length > 0 
                ? `${selectedCategories.length} categorieën geselecteerd`
                : "Selecteer categorieën"
              }
            </Text>
          </TouchableOpacity>
        </View>

        {/* Game Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, themeStyles.text]}>🎮 Instellingen</Text>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, themeStyles.text]}>Aantal imposters:</Text>
            <View style={styles.settingButtons}>
              {[1, 2, 3].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.settingButton,
                    settings.numberOfImposters === num && styles.settingButtonActive,
                    themeStyles.button
                  ]}
                  onPress={() => setSettings(prev => ({ ...prev, numberOfImposters: num }))}
                >
                  <Text style={[
                    styles.settingButtonText,
                    settings.numberOfImposters === num && styles.settingButtonTextActive,
                    themeStyles.buttonText
                  ]}>
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, themeStyles.text]}>Timer:</Text>
            <Switch
              value={settings.timerEnabled}
              onValueChange={(value) => setSettings(prev => ({ ...prev, timerEnabled: value }))}
            />
          </View>
        </View>

        {/* Start Button */}
        <TouchableOpacity
          style={[styles.startButton, themeStyles.primaryButton]}
          onPress={handleStartGame}
        >
          <Text style={styles.startButtonText}>🚀 Start Spel</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Player Modal */}
   
   <Modal visible={showPlayerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, themeStyles.modalContent]}>
            <Text style={[styles.modalTitle, themeStyles.text]}>Speler bewerken</Text>
            <TextInput
              style={[styles.textInput, themeStyles.textInput]}
              value={newPlayerName}
              onChangeText={setNewPlayerName}
              placeholder="Speler naam"
              placeholderTextColor={isDarkTheme ? "#888" : "#666"}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={handleRemovePlayer}
              >
                <Text style={styles.deleteButtonText}>🗑️ Verwijderen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, themeStyles.primaryButton]}
                onPress={handleUpdatePlayer}
              >
                <Text style={styles.startButtonText}>💾 Opslaan</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.modalButton, themeStyles.button]}
              onPress={() => setShowPlayerModal(false)}
            >
              <Text style={[styles.buttonText, themeStyles.buttonText]}>Annuleren</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Categories Modal */}
      <Modal visible={showCategoriesModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, themeStyles.modalContent]}>
            <Text style={[styles.modalTitle, themeStyles.text]}>Categorieën selecteren</Text>
            <ScrollView style={styles.categoriesList}>
              {categories?.map((category) => (
                <TouchableOpacity
                  key={category._id}
                  style={[
                
    styles.categoryItem,
                    selectedCategories.includes(category.name) && styles.categoryItemSelected,
                    themeStyles.button
                  ]}
                  onPress={() => handleCategoryToggle(category.name)}
                >
                  <Text style={[styles.categoryText, themeStyles.buttonText]}>
                    {selectedCategories.includes(category.name) ? "✅" : "⬜"} {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalButton, themeStyles.primaryButton]}
              onPress={() => setShowCategoriesModal(false)}
            >
              <Text style={styles.startButtonText}>✅ Klaar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },
  playersList: {
    gap: 10,
  },
  playerItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
    gap: 12,
  },
  playerColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  playerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
  playerEdit: {
    fontSize: 16,
  },
  addPlayerButton: {
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderStyle: "dashed",
  },
  addPlayerText: {
    fontSize: 16,
    fontWeight: "500",
  },
  categoriesButton: {
    pad
ding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  settingButtons: {
    flexDirection: "row",
    gap: 8,
  },
  settingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  settingButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  settingButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  settingButtonTextActive: {
    color: "white",
  },
  startButton: {
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  deleteButton: {
    backgroundColor: "#FF3B30",
  },
  deleteButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  categoriesList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  categoryItem: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  categoryItemSelected: {
    backgroundColor: "#007AFF20",
    borderColor: "#007AFF",

  },
  categoryText: {
    fontSize: 16,
  },
});

const lightStyles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
  },
  text: {
    color: "#000000",
  },
  button: {
    backgroundColor: "#F2F2F7",
    borderColor: "#E5E5EA",
  },
  buttonText: {
    color: "#000000",
  },
  primaryButton: {
    backgroundColor: "#007AFF",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
  },
  textInput: {
    backgroundColor: "#F2F2F7",
    borderColor: "#E5E5EA",
    color: "#000000",
  },
});

const darkStyles = StyleSheet.create({
  container: {
    backgroundColor: "#000000",
  },
  text: {
    color: "#FFFFFF",
  },
  button: {
    backgroundColor: "#1C1C1E",
    borderColor: "#38383A",
  },
  buttonText: {
    color: "#FFFFFF",
  },
  primaryButton: {
    backgroundColor: "#0A84FF",
  },
  modalContent: {
    backgroundColor: "#1C1C1E",
  },
  textInput: {
    backgroundColor: "#2C2C2E",
    borderColor: "#38383A",
    color: "#FFFFFF",
  },
});
