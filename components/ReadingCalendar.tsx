import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { queryAll } from '../db/db';
interface ReadingCalendarProps {
  onDatePress?: (date: string, minutes: number) => void;
}

interface DayData {
  date: string;
  minutes: number;
  hasData: boolean;
}

export default function ReadingCalendar({ onDatePress }: ReadingCalendarProps) {
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMonthData();
  }, [currentDate]);

  const loadMonthData = async () => {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      // Get first and last day of the month
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      // Get reading data for the month
      const startDate = firstDay.toISOString().split('T')[0];
      const endDate = lastDay.toISOString().split('T')[0];
      
      const readingData = await queryAll<{date: string, total_minutes: number}>(
        `SELECT date, SUM(minutes_read) as total_minutes 
         FROM reading_sessions 
         WHERE date BETWEEN ? AND ?
         GROUP BY date`,
        [startDate, endDate]
      );

      // Create data map for easy lookup
      const dataMap = new Map();
      readingData.forEach(item => {
        dataMap.set(item.date, item.total_minutes);
      });

      // Generate calendar days
      const daysInMonth = lastDay.getDate();
      const monthDataArray: DayData[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateString = date.toISOString().split('T')[0];
        const minutes = dataMap.get(dateString) || 0;
        
        monthDataArray.push({
          date: dateString,
          minutes,
          hasData: minutes > 0
        });
      }

      setMonthData(monthDataArray);
    } catch (error) {
      console.error('Error loading month data:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const getColorIntensity = (minutes: number) => {
    if (minutes === 0) return '#F1F5F9';
    if (minutes <= 15) return '#DDD6FE';
    if (minutes <= 30) return '#C4B5FD';
    if (minutes <= 60) return '#A78BFA';
    if (minutes <= 90) return '#8B5CF6';
    return '#7C3AED';
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const isToday = (dateString: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateString === today;
  };
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigateMonth('prev')}
          style={styles.navButton}
        >
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>
        
        <Text style={styles.monthTitle}>{formatMonthYear(currentDate)}</Text>
        
        <TouchableOpacity 
          onPress={() => navigateMonth('next')}
          style={styles.navButton}
        >
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekDaysHeader}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <Text key={day} style={styles.weekDayLabel}>{day}</Text>
        ))}
      </View>

      <View style={styles.calendar}>
        {/* Empty cells for days before the first day of the month */}
        {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }).map((_, index) => (
          <View key={`empty-${index}`} style={styles.emptyDay} />
        ))}
        
        {/* Calendar days */}
        {monthData.map((dayData, index) => {
          const dayNumber = index + 1;
          const backgroundColor = getColorIntensity(dayData.minutes);
          
          return (
            <TouchableOpacity
              key={dayData.date}
              style={[
                styles.day,
                { backgroundColor },
                isToday(dayData.date) && styles.today
              ]}
              onPress={() => onDatePress?.(dayData.date, dayData.minutes)}
            >
              <Text style={[
                styles.dayNumber,
                dayData.hasData && styles.dayNumberWithData,
                isToday(dayData.date) && styles.todayText
              ]}>
                {dayNumber}
              </Text>
              {dayData.minutes > 0 && (
                <Text style={styles.minutesText}>{dayData.minutes} {t('components.readingTimeLogger.minutesShort')}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Reading Activity</Text>
        <View style={styles.legendColors}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSquare, { backgroundColor: '#F1F5F9' }]} />
            <Text style={styles.legendText}>None</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSquare, { backgroundColor: '#DDD6FE' }]} />
            <Text style={styles.legendText}>Light</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSquare, { backgroundColor: '#A78BFA' }]} />
            <Text style={styles.legendText}>Moderate</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSquare, { backgroundColor: '#7C3AED' }]} />
            <Text style={styles.legendText}>Heavy</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  navButtonText: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: 'bold',
  },
  weekDaysHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    paddingVertical: 4,
  },
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  emptyDay: {
    width: '14.28%',
    aspectRatio: 1,
  },
  day: {
    width: '14.28%',
    aspectRatio: 1,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    margin: 1,
  },
  today: {
    borderWidth: 2,
    borderColor: '#6C63FF',
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  dayNumberWithData: {
    color: '#1E293B',
    fontWeight: '700',
  },
  todayText: {
    color: '#6C63FF',
    fontWeight: 'bold',
  },
  minutesText: {
    fontSize: 8,
    color: '#64748B',
    marginTop: 1,
  },
  legend: {
    alignItems: 'center',
  },
  legendTitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  legendColors: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    alignItems: 'center',
    gap: 4,
  },
  legendSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
    color: '#64748B',
  },
});
