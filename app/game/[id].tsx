

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Alert,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import * as Haptics from "expo-haptics";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface GameCardProps {
  word?: string;
  hintWord?: string;
  isImposter: boolean;
  theme: "light" | "dark";
  onCardFlipped: () => void;
  onCardUnflipped: () => void;
}

function GameCard({ word, hintWord, isImposter, theme, onCardFlipped, onCardUnflipped }: GameCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [wasFlipped, setWasFlipped] = useState(false);
  const flipAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  
  const isDarkTheme = theme === "dark";
  
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => false,
    
    onPanResponderGrant: () => {
      if (!isFlipped) {
        flipCard();
      }
    },
    
    onPanResponderRelease: () => {
      if (isFlipped) {
        unflipCard();
      }
    },
  });

  const flipCard = () => {
    if (isFlipped) return;
    
    setIsFlipped(true);
    setWasFlipped(true);
    onCardFlipped();
    
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    Animated.parallel([
      Animated.timing(flipAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scaleAnimation, {
          toValue: 1.05,
          duration: 150,
          useNativeDriver: true,
 
       }),
        Animated.timing(scaleAnimation, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const unflipCard = () => {
    if (!isFlipped) return;
    
    setIsFlipped(false);
    onCardUnflipped();
    
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    Animated.timing(flipAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const frontRotation = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const backRotation = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });

  const cardStyles = isDarkTheme ? darkCardStyles : lightCardStyles;

  return (
    <View style={styles.cardContainer} {...panResponder.panHandlers}>
      <Animated.View
        style={[
          styles.card,
          cardStyles.cardBack,
          {
            transform: [
              { rotateY: frontRotation },
              { scale: scaleAnimation },
            ],
          },
        ]}
      >
        <Text style={[styles.cardBackText, cardStyles.cardBackText]}>
          🃏
        </Text>
        <Text style={[styles.cardInstructions, cardStyles.cardInstructions]}>
          Houd vast om te bekijken
        </Text>
      </Animated.View>
      
      <Animated.View
        style={[
          styles.card,
          styles.cardFront,
          cardStyles.cardFront,
          {
            transform: [
              { rotateY: backRotation },
              { scale: scaleAnimation },
            ],
          },
        ]}
      >
        {isImposter ? (
          <View style={styles.imposterContent}>
            <Text style={[styles.imposterTitle, cardStyles.imposterTitle]}>
              🕵️ IMPOSTER
            </Text>
            <Text style={[styles.hintText, cardStyles.hintText]}>
              Hint: {hintWord}
            </Text>
         
   <Text style={[styles.imposterInstructions, cardStyles.imposterInstructions]}>
              Probeer het woord te raden!
            </Text>
          </View>
        ) : (
          <View style={styles.wordContent}>
            <Text style={[styles.wordText, cardStyles.wordText]}>
              {word}
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = id as Id<"games">;
  
  const [cardWasFlipped, setCardWasFlipped] = useState(false);
  const [cardIsCurrentlyFlipped, setCardIsCurrentlyFlipped] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  
  // Convex hooks
  const game = useQuery(api.games.getGame, { gameId });
  const players = useQuery(api.players.getPlayers, { gameId });
  const nextPlayer = useMutation(api.games.nextPlayer);
  const endGame = useMutation(api.games.endGame);
  const resetToLobby = useMutation(api.games.resetToLobby);
  
  // Timer effect
  useEffect(() => {
    if (!game?.settings.timerEnabled || !game.timerStartTime) {
      setTimeRemaining(null);
      return;
    }
    
    const interval = setInterval(() => {
      const elapsed = (Date.now() - game.timerStartTime!) / 1000;
      const remaining = Math.max(0, game.settings.timerDuration - elapsed);
      setTimeRemaining(remaining);
      
      if (remaining === 0) {
        // Timer expired, move to next phase
        if (game.status === "playing") {
          nextPlayer({ gameId });
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [game?.timerStartTime, game?.settings.timerEnabled, game?.settings.timerDuration]);

  const handleCardFlipped = () => {
    setCardWasFlipped(true);
    setCardIsCurrentlyFlipped(true);
  };

  const handleCardUnflipped = () => {
    setCardIsCurrentlyFlipped(false);
  };

  const handleNextPlayer = async () => {
    if (!cardWasFlipped) {
      Alert.alert("Wacht even"
, "Bekijk eerst je kaart!");
      return;
    }
    
    if (cardIsCurrentlyFlipped) {
      Alert.alert("Wacht even", "Laat eerst je kaart los!");
      return;
    }
    
    try {
      await nextPlayer({ gameId });
      setCardWasFlipped(false);
      
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to go to next player");
    }
  };

  const handleEndGame = () => {
    Alert.alert(
      "Spel beëindigen",
      "Weet je zeker dat je het spel wilt beëindigen?",
      [
        { text: "Annuleren", style: "cancel" },
        {
          text: "Beëindigen",
          style: "destructive",
          onPress: async () => {
            try {
              await resetToLobby({ gameId });
              router.replace("/");
            } catch (error) {
              Alert.alert("Error", "Failed to end game");
            }
          },
        },
      ]
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!game || !players) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Laden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentPlayer = players[game.currentPlayerIndex];
  const isImposter = game.imposters.includes(game.currentPlayerIndex);
  const isDarkTheme = game.settings.theme === "dark";
  const themeStyles = isDarkTheme ? darkStyles : lightStyles;

  if (game.status === "discussion") {
    return (
      <SafeAreaView style={[styles.container, themeStyles.container]}>
        <View style={styles.discussionContainer}>
          <Text style={[styles.discussionTitle, themeStyles.text]}>
            💬 Discussie tijd!
          </Text>
          <Text style={[styles.discussionText, themeStyles.text]}>
         
   Bespreek wie jullie denken dat de imposter is.
          </Text>
          {timeRemaining !== null && (
            <Text style={[styles.timerText, themeStyles.text]}>
              ⏰ {formatTime(timeRemaining)}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.endButton, themeStyles.primaryButton]}
            onPress={() => router.push(`/results/${gameId}`)}
          >
            <Text style={styles.endButtonText}>🗳️ Naar stemmen</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          style={[styles.exitButton, themeStyles.exitButton]}
          onPress={handleEndGame}
        >
          <Text style={[styles.exitButtonText, themeStyles.exitButtonText]}>✕</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, themeStyles.container]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.playerInfo}>
          <Text style={[styles.currentPlayerText, themeStyles.text]}>
            Speler aan de beurt:
          </Text>
          <View style={styles.playerIndicator}>
            <View
              style={[
                styles.playerColor,
                { backgroundColor: currentPlayer.color },
              ]}
            />
            <Text style={[styles.playerName, themeStyles.text]}>
              {currentPlayer.name}
            </Text>
          </View>
        </View>
        
        {timeRemaining !== null && (
          <Text style={[styles.timerText, themeStyles.text]}>
            ⏰ {formatTime(timeRemaining)}
          </Text>
        )}
        
        <TouchableOpacity
          style={[styles.exitButton, themeStyles.exitButton]}
          onPress={handleEndGame}
        >
          <Text style={[styles.exitButtonText, themeStyles.exitButtonText]}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <View style={styles.progressContainer}>
        <Text style={[styles.pr
ogressText, themeStyles.text]}>
          {game.currentPlayerIndex + 1} / {players.length}
        </Text>
        <View style={[styles.progressBar, themeStyles.progressBar]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${((game.currentPlayerIndex + 1) / players.length) * 100}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Card */}
      <View style={styles.cardArea}>
        <GameCard
          word={game.currentWord}
          hintWord={game.hintWord}
          isImposter={isImposter}
          theme={game.settings.theme}
          onCardFlipped={handleCardFlipped}
          onCardUnflipped={handleCardUnflipped}
        />
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={[styles.instructionsText, themeStyles.text]}>
          {!cardWasFlipped
            ? "Houd de kaart vast om je rol te bekijken"
            : cardIsCurrentlyFlipped
            ? "Laat de kaart los en geef door aan de volgende speler"
            : "Geef het apparaat door aan de volgende speler"
          }
        </Text>
      </View>

      {/* Next Button */}
      <TouchableOpacity
        style={[
          styles.nextButton,
          (!cardWasFlipped || cardIsCurrentlyFlipped) && styles.nextButtonDisabled,
          themeStyles.primaryButton,
        ]}
        onPress={handleNextPlayer}
        disabled={!cardWasFlipped || cardIsCurrentlyFlipped}
      >
        <Text style={styles.nextButtonText}>
          {game.currentPlayerIndex === players.length - 1
            ? "🎯 Start discussie"
            : "➡️ Volgende speler"
          }
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    color: "#666",
  },
  header: {
    flexDirection: "ro
w",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingBottom: 10,
  },
  playerInfo: {
    flex: 1,
  },
  currentPlayerText: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  playerIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  playerColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  playerName: {
    fontSize: 18,
    fontWeight: "bold",
  },
  timerText: {
    fontSize: 18,
    fontWeight: "bold",
    marginHorizontal: 20,
  },
  exitButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  exitButtonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  progressText: {
    textAlign: "center",
    fontSize: 16,
    marginBottom: 8,
    opacity: 0.7,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#007AFF",
  },
  cardArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  cardContainer: {
    width: screenWidth * 0.8,
    height: screenHeight * 0.4,
    maxWidth: 300,
    maxHeight: 400,
  },
  card: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backfaceVisibility: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardFront: {
    padding: 20,
  },
  cardBackText: {
    fontSize: 60,
    marginBottom: 20,
  },
  cardInstructions: {
    fontSize: 16,
    textAlign: "center",
    opacity: 0.7,
  },
  imposterContent: {
    alignItems: "center",
    gap: 20,
  },
  imposterTitle: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
  },
  hintText: {
    fontSize: 20,
    textAlign: "center",
  
  fontWeight: "500",
  },
  imposterInstructions: {
    fontSize: 16,
    textAlign: "center",
    opacity: 0.8,
  },
  wordContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  wordText: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
  },
  instructionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  instructionsText: {
    fontSize: 16,
    textAlign: "center",
    opacity: 0.7,
  },
  nextButton: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  discussionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    gap: 20,
  },
  discussionTitle: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
  },
  discussionText: {
    fontSize: 18,
    textAlign: "center",
    opacity: 0.8,
  },
  endButton: {
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 20,
  },
  endButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
});

const lightStyles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
  },
  text: {
    color: "#000000",
  },
  primaryButton: {
    backgroundColor: "#007AFF",
  },
  exitButton: {
    backgroundColor: "#FF3B30",
  },
  exitButtonText: {
    color: "white",
  },
  progressBar: {
    backgroundColor: "#E5E5EA",
  },
});

const darkStyles = StyleSheet.create({
  container: {
    backgroundColor: "#000000",
  },
  text: {
    color: "#FFFFFF",
  },
  primaryButton: {
    backgroundColor: "#0A84FF",
  },
  exitButton: {
    backgroundColor: "#FF453A",
  },
  exitButtonText: {
    color: "white",
  },
  progressBar: {
    backgroundColor: "#38383A",
  },
});

const lightCardStyles = StyleSheet.create({
  cardBack: {
    backgroundColor: "#F2F2F7",
    borderWidth: 2,
    borderColor: "#E5E5EA",
  },
  cardBackText: {
    color: 
"#000000",
  },
  cardInstructions: {
    color: "#666666",
  },
  cardFront: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E5E5EA",
  },
  imposterTitle: {
    color: "#FF3B30",
  },
  hintText: {
    color: "#007AFF",
  },
  imposterInstructions: {
    color: "#666666",
  },
  wordText: {
    color: "#000000",
  },
});

const darkCardStyles = StyleSheet.create({
  cardBack: {
    backgroundColor: "#1C1C1E",
    borderWidth: 2,
    borderColor: "#38383A",
  },
  cardBackText: {
    color: "#FFFFFF",
  },
  cardInstructions: {
    color: "#AEAEB2",
  },
  cardFront: {
    backgroundColor: "#2C2C2E",
    borderWidth: 2,
    borderColor: "#38383A",
  },
  imposterTitle: {
    color: "#FF453A",
  },
  hintText: {
    color: "#0A84FF",
  },
  imposterInstructions: {
    color: "#AEAEB2",
  },
  wordText: {
    color: "#FFFFFF",
  },
});
