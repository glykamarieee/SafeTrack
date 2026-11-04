import { useCallback, useRef, useState } from "react";
import { RefreshControl, type RefreshControlProps } from "react-native";

import { useTheme } from "../../theme/ThemeProvider";

type Props = Omit<RefreshControlProps, "refreshing" | "onRefresh"> & {
  /** Reloads the screen; the spinner shows until it settles. */
  onRefresh: () => unknown;
};

/**
 * Pull down to refresh, for a ScrollView or list's `refreshControl`. Keeps
 * its own spinner state, so a screen only passes its reload function.
 * Extra props (ScrollView passes style and children on Android) go through.
 */
export function PullRefresh({ onRefresh, ...rest }: Props) {
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      await onRefresh();
    } catch {
      // Each screen shows its own load errors.
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  }, [onRefresh]);

  return (
    <RefreshControl
      {...rest}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      tintColor={colors.primary}
      colors={[colors.primary]}
    />
  );
}
