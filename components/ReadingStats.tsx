import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ReadingStatsProps {
  weeklyMinutes: number[];
  monthlyGoal?: number;
  averageDaily?: number;
}

export default function ReadingStats({ 
  weeklyMinutes, 
  monthlyGoal = 900, // 30 minutes * 30 days
  averageDaily 
}: ReadingStatsProps) {
  const totalWeeklyMinutes = weeklyMinutes.reduce((sum, minutes) => sum + minutes, 0);
  const avgDailyThisWeek = Math.round(totalWeeklyMinutes / 7);
  const weeklyGoal = 210; // 30 minutes * 7 days
  const weeklyProgress = Math.min((totalWeeklyMinutes / weeklyGoal) * 100, 100);

  const formatTime = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📊 This Week's Reading</Text>
      
      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatTime(totalWeeklyMinutes)}</Text>
            <Text style={styles.statLabel}>Total This Week</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatTime(avgDailyThisWeek)}</Text>
            <Text style={styles.statLabel}>Daily Average</Text>
          </View>
        </View>

        {/* Weekly Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBackground}>
            <View 
              style={[
                styles.progressBarFill, 
                { width: `${weeklyProgress}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(weeklyProgress)}% of weekly goal ({formatTime(weeklyGoal)})
          </Text>
        </View>

        {/* Daily Breakdown */}
        <View style={styles.dailyBreakdown}>
          <Text style={styles.breakdownTitle}>Daily Breakdown</Text>
          <View style={styles.dailyBars}>
            {weeklyMinutes.map((minutes, index) => {
              const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              const today = new Date();
              const dayIndex = (today.getDay() - 6 + index) % 7;
              const isToday = index === 6; // Last item is today
              
              return (
                <View key={index} style={styles.dayBar}>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        { 
                          height: `${Math.max((minutes / 60) * 100, 5)}%`,
                          backgroundColor: isToday ? '#6C63FF' : '#E2E8F0'
                        }
                      ]}
                    />
                  </View>
                  <Text style={[
                    styles.dayLabel,
                    isToday && styles.todayLabel
                  ]}>
                    {dayNames[dayIndex]}
                  </Text>
                  <Text style={styles.minutesLabel}>{minutes}m</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  statsContainer: {
    gap: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
  },
  progressContainer: {
    gap: 8,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6C63FF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  dailyBreakdown: {
    marginTop: 8,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  dailyBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 60,
    gap: 4,
  },
  dayBar: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barContainer: {
    height: 40,
    width: '80%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 2,
    minHeight: 2,
  },
  dayLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  todayLabel: {
    color: '#6C63FF',
    fontWeight: '600',
  },
  minutesLabel: {
    fontSize: 8,
    color: '#94A3B8',
  },
});
