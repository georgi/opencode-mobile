import React, { useCallback, useRef, type ReactNode } from "react"
import { Animated, Pressable, type PressableProps, type ViewStyle, type StyleProp } from "react-native"

type PressableScaleProps = Omit<PressableProps, "children" | "style"> & {
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}

export function PressableScale({ style, children, disabled, ...rest }: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start()
  }, [scale])

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start()
  }, [scale])

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      {...rest}
    >
      <Animated.View
        style={[
          style,
          { transform: [{ scale }], opacity: disabled ? 0.5 : 1 },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  )
}
