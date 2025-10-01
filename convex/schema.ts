

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  games: defineTable({
    status: v.union(v.literal("lobby"), v.literal("playing"), v.literal("discussion"), v.literal("results"), v.literal("ended")),
    currentPlayerIndex: v.number(),
    currentRound: v.number(),
    totalRounds: v.number(),
    selectedCategories: v.array(v.string()),
    currentWord: v.optional(v.string()),
    hintWord: v.optional(v.string()),
    imposters: v.array(v.number()), // player indices who are imposters
    settings: v.object({
      theme: v.union(v.literal("light"), v.literal("dark")),
      language: v.string(),
      trollMode: v.boolean(),
      timerEnabled: v.boolean(),
      timerDuration: v.number(), // in seconds
      numberOfImposters: v.number(),
      wordsPerRound: v.number(),
    }),
    timerStartTime: v.optional(v.number()),
    votes: v.optional(v.record(v.string(), v.number())), // playerId -> votedForPlayerIndex
    gameCode: v.string(),
  }),
  
  players: defineTable({
    gameId: v.id("games"),
    name: v.string(),
    color: v.string(),
    index: v.number(),
    isActive: v.boolean(),
  }).index("by_game", ["gameId"]),
  
  categories: defineTable({
    name: v.string(),
    emoji: v.string(),
    words: v.array(v.object({
      word: v.string(),
      hint: v.string(),
    })),
    isDefault: v.boolean(),
  }),
});
