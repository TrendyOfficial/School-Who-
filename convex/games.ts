

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const createGame = mutation({
  args: {
    gameCode: v.string(),
    settings: v.object({
      theme: v.union(v.literal("light"), v.literal("dark")),
      language: v.string(),
      trollMode: v.boolean(),
      timerEnabled: v.boolean(),
      timerDuration: v.number(),
      numberOfImposters: v.number(),
      wordsPerRound: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const gameId = await ctx.db.insert("games", {
      status: "lobby",
      currentPlayerIndex: 0,
      currentRound: 1,
      totalRounds: args.settings.wordsPerRound,
      selectedCategories: [],
      imposters: [],
      settings: args.settings,
      gameCode: args.gameCode,
    });
    
    return gameId;
  },
});

export const getGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.gameId);
  },
});

export const updateGameSettings = mutation({
  args: {
    gameId: v.id("games"),
    settings: v.object({
      theme: v.union(v.literal("light"), v.literal("dark")),
      language: v.string(),
      trollMode: v.boolean(),
      timerEnabled: v.boolean(),
      timerDuration: v.number(),
      numberOfImposters: v.number(),
      wordsPerRound: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.gameId, {
      settings: args.settings,
      totalRounds: args.settings.wordsPerRound,
    });
  },
});

export const updateSelectedCategories = mutation({
  args: {
    gameId: v.id("games"),
    categories: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.gameId, {
      selectedCategories: args.categories,
    });
  },
});

export const startGame = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    
    const players
 = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    if (players.length < 3) {
      throw new Error("Need at least 3 players to start");
    }
    
    if (game.selectedCategories.length === 0) {
      throw new Error("Select at least one category");
    }
    
    // Get all words from selected categories
    const categories = await ctx.db
      .query("categories")
      .filter((q) => 
        q.or(
          ...game.selectedCategories.map(catName => 
            q.eq(q.field("name"), catName)
          )
        )
      )
      .collect();
    
    const allWords = categories.flatMap(cat => cat.words);
    if (allWords.length === 0) {
      throw new Error("No words found in selected categories");
    }
    
    // Select random word
    const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
    
    // Assign imposters randomly
    const numberOfImposters = Math.min(game.settings.numberOfImposters, players.length - 1);
    const imposterIndices: number[] = [];
    
    while (imposterIndices.length < numberOfImposters) {
      const randomIndex = Math.floor(Math.random() * players.length);
      if (!imposterIndices.includes(randomIndex)) {
        imposterIndices.push(randomIndex);
      }
    }
    
    await ctx.db.patch(args.gameId, {
      status: "playing",
      currentPlayerIndex: 0,
      currentWord: randomWord.word,
      hintWord: randomWord.hint,
      imposters: imposterIndices,
      timerStartTime: game.settings.timerEnabled ? Date.now() : undefined,
    });
  },
});

export const nextPlayer = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("isActive"), true
))
      .collect();
    
    const nextIndex = game.currentPlayerIndex + 1;
    
    if (nextIndex >= players.length) {
      // All players have seen their cards, move to discussion
      await ctx.db.patch(args.gameId, {
        status: "discussion",
        timerStartTime: game.settings.timerEnabled ? Date.now() : undefined,
      });
    } else {
      await ctx.db.patch(args.gameId, {
        currentPlayerIndex: nextIndex,
      });
    }
  },
});

export const submitVotes = mutation({
  args: {
    gameId: v.id("games"),
    votes: v.record(v.string(), v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.gameId, {
      status: "results",
      votes: args.votes,
    });
  },
});

export const endGame = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.gameId, {
      status: "ended",
    });
  },
});

export const resetToLobby = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.gameId, {
      status: "lobby",
      currentPlayerIndex: 0,
      currentRound: 1,
      currentWord: undefined,
      hintWord: undefined,
      imposters: [],
      timerStartTime: undefined,
      votes: undefined,
    });
  },
});
