import { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text } from "react-native";
import { ScreenContainer } from "../../components/common/ScreenContainer";
import { LoadingState } from "../../components/common/LoadingState";
import { ErrorState } from "../../components/common/ErrorState";
import { EmptyState } from "../../components/common/EmptyState";
import { OfflineBanner } from "../../components/common/OfflineBanner";
import { ReportListItem } from "../../components/reports/ReportListItem";
import { ReportFilterBar, ReportDateFilter } from "../../components/reports/ReportFilterBar";
import { useAuthStore } from "../../store/authStore";
import { useReportsStore } from "../../store/reportsStore";
import { spacing, typography } from "../../constants/theme";

function withinDateFilter(generatedAt: string, filter: ReportDateFilter) {
  if (filter === "all") return true;
  const days = filter === "last7" ? 7 : 30;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(generatedAt).getTime() >= cutoff;
}

export default function ReportsScreen() {
  const role = useAuthStore((s) => s.role);
  const guardian = useAuthStore((s) => s.guardian);
  const reports = useReportsStore((s) => s.reports);
  const isLoading = useReportsStore((s) => s.isLoading);
  const error = useReportsStore((s) => s.error);
  const isOffline = useReportsStore((s) => s.isOffline);
  const cachedAt = useReportsStore((s) => s.cachedAt);
  const loadForGuardian = useReportsStore((s) => s.loadForGuardian);
  const loadAll = useReportsStore((s) => s.loadAll);
  const [filter, setFilter] = useState<ReportDateFilter>("all");

  useEffect(() => {

  if(role==="admin"){

    void loadAll();

  }
  else if(
    role==="guardian" &&
    guardian
  ){

    void loadForGuardian(
      guardian.id
    );

  }

},[
  role,
  guardian?.id,
]);

  const filtered = useMemo(() => reports.filter((r) => withinDateFilter(r.generatedAt, filter)), [reports, filter]);

  if (role === "child") {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Reports</Text>
        <EmptyState icon="lock-closed-outline" title="Not available" message="Reports are managed by your guardian." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Reports</Text>
      {isOffline ? <OfflineBanner cachedAt={cachedAt} /> : null}
      <ReportFilterBar selected={filter} onSelect={setFilter} />

      {isLoading && reports.length === 0 ? (
        <LoadingState message="Loading reports..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => (role === "admin" ? loadAll() : guardian && loadForGuardian(guardian.id))} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="document-text-outline" title="No reports yet" message="Generated reports will appear here." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => <ReportListItem report={item} />}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.display,
    marginBottom: spacing.lg,
  },
});
