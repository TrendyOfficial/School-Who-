

import React from "react";
import { View, Text } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// Simple test component to verify Convex integration works
export default function TestComponent() {
  const categories = useQuery(api.categories.getCategories, {});
  
  return (
    <View>
      <Text>Categories loaded: {categories?.length || 0}</Text>
    </View>
  );
}
