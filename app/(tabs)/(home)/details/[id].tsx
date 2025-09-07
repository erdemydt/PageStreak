import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function DetailsScreen() {
  const { id } = useLocalSearchParams();
  let title = `Details of ${id}`;
  const toCamelCase = (str: string) => {
    return str
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };
  title = toCamelCase(title);

  return (
    // Add camel case to the title

    <>
      <Stack.Screen options={{ title }} />
      
      <View style={styles.container}>
        <Text>Details of user {id} </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
