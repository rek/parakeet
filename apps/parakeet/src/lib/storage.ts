import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const storage = Platform.OS === 'web' ? undefined : AsyncStorage

export default storage
