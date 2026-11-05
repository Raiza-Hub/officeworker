import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
    ownerId: v.id("users"),
  }).index("by_owner", ["ownerId"]),
  documents: defineTable({
    name: v.string(),
    type: v.string(),
    size: v.number(),
    storageKey: v.string(),
    status: v.union(v.literal("Uploading"), v.literal("Success")),
    ownerId: v.id("users"),
  })
    .index("by_owner", ["ownerId"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["ownerId"],
    }),
});
