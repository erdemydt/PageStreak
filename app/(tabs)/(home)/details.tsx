import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function DetailsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Details" }} />
      <View style={styles.container}>
        <Text>Details</Text>
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
