import { useAppTheme } from '@/lib/theme/context';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const { colorScheme, hasHydrated } = useAppTheme();
  return hasHydrated ? colorScheme : 'light';
}
