import { Redirect } from 'expo-router'

export default function Index() {

console.log('test')

  return <Redirect href="/(auth)/welcome" />
}
