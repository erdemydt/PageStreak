import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

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
  const { t } = useTranslation();
  const percentage = goalMinutes > 0 ? Math.min((todayMinutes / goalMinutes) * 100, 100) : 0;
  const isGoalReached = todayMinutes >= goalMinutes;
  
  // Calculate the visual progress for the circular progress
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const formatMinutes = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60); 
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours} ${t('settings.hours')} ${remainingMinutes} ${t('components.readingTimeLogger.minutesShort')}` : `${hours} ${t('settings.hours')}`;
    }
    return `${minutes} ${t('components.readingTimeLogger.minutesShort')}`;
  };

  const getMotivationMessage = () => {
    if (isGoalReached) {
      return t('components.dailyProgress.goalCrushed');
    } else if (percentage >= 75) {
      return t('components.dailyProgress.almostThere');
    } else if (percentage >= 50) {
      return t('components.dailyProgress.goodProgress');
    } else if (percentage >= 25) {
      return t('components.dailyProgress.greatStart');
    } else if (todayMinutes > 0) {
      return t('components.dailyProgress.everyMinute');
    } else {
      return t('components.dailyProgress.readyToStart');
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('components.dailyProgress.title')}</Text>
      
      <View style={styles.progressContainer}>
        {/* Progress Ring */}
        <View style={styles.progressRing}>
          <Svg width={90} height={90}>
            {/* Background Circle */}
            <Circle
              cx={45}
              cy={45}
              r={40}
              stroke="#E2E8F0"
              strokeWidth={8}
              fill="transparent"
            />
            {/* Progress Circle */}
            <Circle
              cx={45}
              cy={45}
              r={40}
              stroke={isGoalReached ? "#10B981" : "#6C63FF"}
              strokeWidth={8}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 45 45)"
            />
          </Svg>
          
          <View style={styles.progressTextContainer}>
            <Text style={styles.progressPercentage}>
              {Math.round(percentage)}%
            </Text>
            <Text style={styles.progressLabel}>{t('components.dailyProgress.complete')}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatMinutes(todayMinutes)}</Text>
            <Text style={styles.statLabel}>{t('components.dailyProgress.today')}</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatMinutes(goalMinutes)}</Text>
            <Text style={styles.statLabel}>{t('components.dailyProgress.goal')}</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{streakDays}</Text>
            <Text style={styles.statLabel}>{t('components.dailyProgress.dayStreak')}</Text>
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
          {t('components.dailyProgress.leftToReach', { time: formatMinutes(goalMinutes - todayMinutes) })}
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
    flexDirection: 'column',
    gap: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressRing: {
    position: 'relative',
    width: 90,
    height: 90,
    marginRight: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
  },
  stats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
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
