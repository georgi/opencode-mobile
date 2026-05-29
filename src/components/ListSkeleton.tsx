import React from "react"
import { View, StyleSheet } from "react-native"
import { palette } from "../constants/theme"

type ListSkeletonProps = {
  count?: number
  /** Approximate row height, in px. */
  rowHeight?: number
}

/**
 * Static row placeholders shown while a list's initial fetch is in flight,
 * so users can distinguish "still loading" from "truly empty".
 */
export function ListSkeleton({ count = 5, rowHeight = 64 }: ListSkeletonProps) {
  return (
    <View style={styles.container} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.row, { height: rowHeight }]} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 8,
  },
  row: {
    borderRadius: 12,
    backgroundColor: palette.smoke[2],
    opacity: 0.6,
  },
})
