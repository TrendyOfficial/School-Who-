

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import * as Haptics from "expo-haptics";

export default function ResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = id as Id<"games">;
  
  const [selectedVotes, setSelectedVotes] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);
  
  // Convex hooks
  const game = useQuery(api.games.getGame, { gameId });
  const players = useQuery(api.players.getPlayers, { gameId });
  const submitVotes = useMutation(api.games.submitVotes);
  const resetToLobby = useMutation(api.games.resetToLobby);
  
  const handleVote = (voterId: string, votedForIndex: number) => {
    setSelectedVotes(prev => ({
      ...prev,
      [voterId]: votedForIndex,
    }));
    
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSubmitVotes = async () => {
    if (!players) return;
    
    // Check if all players have voted
    const allPlayersVoted = players.every(player => 
      selectedVotes[player._id] !== undefined
    );
    
    if (!allPlayersVoted) {
      Alert.alert("Wacht even", "Niet alle spelers hebben gestemd!");
      return;
    }
    
    try {
      await submitVotes({ gameId, votes: selectedVotes });
      setShowResults(true);
      
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to submit votes");
    }
  };

  const handleNewGame = async () => {
    try {
      await resetToLobby({ gameId });
      router.replace("/");
    } catch (error) {
      Alert.alert("Error", "Failed to start new game");
    }
  };

  const getVoteResults = () => {
    if (!players || !game?.votes) return [];
    
    const voteCounts: Record<number, number> = {};
    
    // Count votes for each player
    Object.values(game.votes).forEach(votedForIndex => {
      voteCounts[votedForIndex] = (voteCounts[votedForIndex] || 0) + 1;
    });
    
    // Create results array
    return players.map((player, index) => ({
      player,
      votes: voteCounts[index] || 0,
      isImposter: game.imposters.includes(index),
    })).sort((a, b) => b.votes - a.votes);
  };

  const getGameOutcome = () => {
    if (!game || !players) return null;
    
    const results = getVoteResults();
    const mostVotedPlayer = results[0];
    
    if (!mostVotedPlayer) return null;
    
    const impostersFound = results.filter(r => r.isImposter && r.votes > 0).length;
    const totalImposters = game.imposters.length;
    
    if (mostVotedPlayer.isImposter) {
      return {
        success: impostersFound === totalImposters,
        message: impostersFound === totalImposters 
          ? "🎉 Gefeliciteerd! Jullie hebben alle imposters gevonden!"
          : "👏 Goed gedaan! Jullie hebben een imposter gevonden, maar er zijn er meer...",
      };
    } else {
      return {
        success: false,
        message: "😈 De imposters hebben gewonnen! Jullie hebben de verkeerde persoon gekozen.",
      };
    }
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

  const isDarkTheme = game.settings.theme === "dark";
  const themeStyles = isDarkTheme ? darkStyles : lightStyles;

  if (showResults || game.status === "results") {
    const results = getVoteResults();
    const outcome = getGameOutcome();
    
    return (
      <SafeAreaView style={[styles.container, themeStyles.container]}>
    
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Outcome */}
          <View style={styles.outcomeContainer}>
            <Text style={[styles.outcomeMessage, themeStyles.text]}>
              {outcome?.message}
            </Text>
          </View>

          {/* Word Reveal */}
          <View style={[styles.wordRevealContainer, themeStyles.cardBackground]}>
            <Text style={[styles.wordRevealTitle, themeStyles.text]}>
              Het woord was:
            </Text>
            <Text style={[styles.wordRevealText, themeStyles.primaryText]}>
              {game.currentWord}
            </Text>
            <Text style={[styles.hintRevealText, themeStyles.text]}>
              Hint: {game.hintWord}
            </Text>
          </View>

          {/* Vote Results */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, themeStyles.text]}>
              🗳️ Stemresultaten
            </Text>
            {results.map((result, index) => (
              <View
                key={result.player._id}
                style={[
                  styles.resultItem,
                  themeStyles.cardBackground,
                  result.isImposter && styles.imposterResult,
                ]}
              >
                <View style={styles.resultHeader}>
                  <View style={styles.playerInfo}>
                    <View
                      style={[
                        styles.playerColor,
                        { backgroundColor: result.player.color },
                      ]}
                    />
                    <Text style={[styles.playerName, themeStyles.text]}>
                      {result.player.name}
                    </Text>
                    {result.isImposter && (
                      <Text style={styles.imposterBadge}>🕵️ IMPOSTER</Text>
                    )}
                  </View>
                  <Text style={[styles.voteCount, themeStyles.text]}>
                    {result.votes} stem{result.votes !== 1 ? "men" : ""}
                  </Text>
                </View>
                {result.votes > 0 && (
                  <View style={[styles.voteBar, themeStyles.progressBar]}>
                    <View
                      style={[
                        styles.voteBarFill,
                        {
                          width: `${(result.votes / Math.max(...results.map(r => r.votes))) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Imposters Reveal */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, themeStyles.text]}>
              🕵️ De imposters waren:
            </Text>
            {game.imposters.map(imposterIndex => {
              const imposter = players[imposterIndex];
              return (
                <View
                  key={imposter._id}
                  style={[styles.imposterReveal, themeStyles.cardBackground]}
                >
                  <View style={styles.playerInfo}>
                    <View
                      style={[
                        styles.playerColor,
                        { backgroundColor: imposter.color },
                      ]}
                    />
                    <Text style={[styles.playerName, themeStyles.text]}>
                      {imposter.name}
                    </Text>
                  </View>
                  <Text style={styles.imposterBadge}>🕵️</Text>
                </View>
              );
            })}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, themeStyles.primaryButton]}
              onPress={handleNewGame}
            >
              <Text style={styles.actionButtonText}>🔄 Nieuw spel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, themeStyles.container]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, themeStyles.text]}>
            🗳️ Tijd om te stemmen!
          </Text>
          <Text style={[styles.subtitle, themeStyles.text]}>
            Wie denken jullie dat de imposter is?
          </Text>
        </View>

        {/* Voting */}
        <View style={styles.section}>
          {players.map((voter) => (
            <View key={voter._id} style={styles.voterSection}>
              <Text style={[styles.voterName, themeStyles.text]}>
                {voter.name} stemt op:
              </Text>
              <View style={styles.voteOptions}>
                {players.map((candidate, candidateIndex) => (
                  <TouchableOpacity
                    key={candidate._id}
                    style={[
                      styles.voteOption,
                      selectedVotes[voter._id] === candidateIndex && styles.voteOptionSelected,
                      themeStyles.cardBackground,
                    ]}
                    onPress={() => handleVote(voter._id, candidateIndex)}
                  >
                    <View
                      style={[
                        styles.candidateColor,
                        { backgroundColor: candidate.color },
                      ]}
                    />
                    <Text style={[styles.candidateName, themeStyles.text]}>
                      {candidate.name}
                    </Text>
                    {selectedVotes[voter._id] === candidateIndex && (
                      <Text style={styles.selectedIcon}>✅</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            themeStyles.primaryButton,
            Object.keys(selectedVotes).length < players.length && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmitVotes}
          disabled={Object.keys(selectedVotes).length < players.length}
        >
          <Text style={styles.submitButtonText}>
            📊 Toon resultaten
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
  scrollView: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    opacity: 0.7,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },
  voterSection: {
    marginBottom: 25,
  },
  voterName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  voteOptions: {
    gap: 8,
  },
  voteOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    gap: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  voteOptionSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#007AFF20",
  },
  candidateColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  candidateName: {
    flex: 1,
    fontSize: 16,
  },
  selectedIcon: {
    fontSize: 16,
  },
  submitButton: {
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 40,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  outcomeContainer: {
    alignItems: "center",
    marginBottom: 30,
    padding: 20,
  },
  outcomeMessage: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 28,
  },
  wordRevealContainer: {
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    marginBottom: 30,
  },
  wordRevealTitle: {
    fontSize: 18,
    marginBottom: 8,
    opacity: 0.7,
  },
  wordRevealText: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
  },
  hintRevealText: {
    fontSize: 16,
    opacity: 0.7,
  },
  resultItem: {
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  imposterResult: {
    borderWidth: 2,
    borderColor: "#FF3B30",
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  playerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  playerColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  playerName: {
    fontSize: 16,
    fontWeight: "500",
  },
  imposterBadge: {
    fontSize: 12,
    backgroundColor: "#FF3B30",
    color: "white",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontWeight: "bold",
  },
  voteCount: {
    fontSize: 16,
    fontWeight: "bold"
,
  },
  voteBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  voteBarFill: {
    height: "100%",
    backgroundColor: "#007AFF",
  },
  imposterReveal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  actionButtons: {
    gap: 15,
    marginBottom: 40,
  },
  actionButton: {
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
  },
  actionButtonText: {
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
  primaryText: {
    color: "#007AFF",
  },
  primaryButton: {
    backgroundColor: "#007AFF",
  },
  cardBackground: {
    backgroundColor: "#F2F2F7",
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
  primaryText: {
    color: "#0A84FF",
  },
  primaryButton: {
    backgroundColor: "#0A84FF",
  },
  cardBackground: {
    backgroundColor: "#1C1C1E",
  },
  progressBar: {
    backgroundColor: "#38383A",
  },
});
