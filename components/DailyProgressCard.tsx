import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface DailyProgressCardProps {
  todayMinutes: number;
  goalMinutes: number;
  streakDays: number;
}

export default function DailyProgressCard({ 
  todayMinutes, 
  goalMinutes, 
  streakDays 
}: DailyProgressCardProps) {
  const percentage = goalMinutes > 0 ? Math.min((todayMinutes / goalMinutes) * 100, 100) : 0;
  const isGoalReached = todayMinutes >= goalMinutes;
  
  // Calculate the visual progress for the circular progress
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const formatMinutes = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  const getMotivationMessage = () => {
    if (isGoalReached) {
      return "🎉 Goal crushed! Amazing work!";
    } else if (percentage >= 75) {
      return "💪 Almost there! Keep going!";
    } else if (percentage >= 50) {
      return "📖 Good progress! You're halfway!";
    } else if (percentage >= 25) {
      return "🌱 Great start! Keep building momentum!";
    } else if (todayMinutes > 0) {
      return "📚 Every minute counts! You got this!";
    } else {
      return "☕ Ready to start your reading session?";
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>📅 Today's Reading Progress</Text>
      
      <View style={styles.progressContainer}>
        {/* Progress Ring */}
        <View style={styles.progressRing}>
          <View style={styles.progressRingBackground} />
          <View style={[
            styles.progressRingFill,
            { 
              backgroundColor: isGoalReached ? "#10B981" : "#6C63FF",
              height: `${percentage}%` 
            }
          ]} />
          
          <View style={styles.progressTextContainer}>
            <Text style={styles.progressPercentage}>
              {Math.round(percentage)}%
            </Text>
            <Text style={styles.progressLabel}>complete</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatMinutes(todayMinutes)}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatMinutes(goalMinutes)}</Text>
            <Text style={styles.statLabel}>Goal</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{streakDays}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
        </View>
      </View>

      {/* Motivation Message */}
      <View style={[
        styles.motivationContainer,
        isGoalReached && styles.motivationContainerSuccess
      ]}>
        <Text style={[
          styles.motivationText,
          isGoalReached && styles.motivationTextSuccess
        ]}>
          {getMotivationMessage()}
        </Text>
      </View>

      {/* Time Remaining */}
      {!isGoalReached && goalMinutes > 0 && (
        <Text style={styles.remainingText}>
          {formatMinutes(goalMinutes - todayMinutes)} left to reach your daily goal
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
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
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  circularProgress: {
    position: 'relative',
    marginRight: 24,
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRing: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRingBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 40,
    backgroundColor: '#E2E8F0',
  },
  progressRingFill: {
    position: 'absolute',
    width: '100%',
    borderRadius: 40,
    bottom: 0,
  },
  progressTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercentage: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  progressLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  stats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
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
  motivationContainer: {
    backgroundColor: '#F8F7FF',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#6C63FF',
    marginBottom: 12,
  },
  motivationContainerSuccess: {
    backgroundColor: '#F0FDF4',
    borderLeftColor: '#10B981',
  },
  motivationText: {
    fontSize: 14,
    color: '#5B21B6',
    fontWeight: '500',
    textAlign: 'center',
  },
  motivationTextSuccess: {
    color: '#047857',
  },
  remainingText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
