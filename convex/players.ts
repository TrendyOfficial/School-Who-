

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addPlayer = mutation({
  args: {
    gameId: v.id("games"),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const existingPlayers = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
    
    const nextIndex = existingPlayers.length;
    
    const playerId = await ctx.db.insert("players", {
      gameId: args.gameId,
      name: args.name,
      color: args.color,
      index: nextIndex,
      isActive: true,
    });
    
    return playerId;
  },
});

export const getPlayers = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .order("asc")
      .collect();
  },
});

export const updatePlayer = mutation({
  args: {
    playerId: v.id("players"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.color !== undefined) updates.color = args.color;
    
    await ctx.db.patch(args.playerId, updates);
  },
});

export const removePlayer = mutation({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) return;
    
    // Mark as inactive instead of deleting to preserve indices
    await ctx.db.patch(args.playerId, { isActive: false });
    
    // Reorder remaining players
    const remainingPlayers = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", player.gameId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .order("asc")
      .collect();
    
    // Update indices
    for (let i = 0; i < remainingPlayers.length; i++)
 {
      if (remainingPlayers[i].index !== i) {
        await ctx.db.patch(remainingPlayers[i]._id, { index: i });
      }
    }
  },
});
