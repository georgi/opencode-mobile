import React from "react"
import { View } from "react-native"

const FlashList = ({ data, renderItem, keyExtractor, contentContainerStyle }: {
  data: unknown[]
  renderItem: ({ item }: { item: unknown }) => React.ReactElement
  keyExtractor: (item: unknown) => string
  contentContainerStyle?: object
}) => {
  return (
    <View style={[contentContainerStyle]}>
      {data.map((item) => (
        <View key={keyExtractor(item)}>{renderItem({ item })}</View>
      ))}
    </View>
  )
}

module.exports = { FlashList, default: FlashList }
