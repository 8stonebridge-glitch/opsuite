import { Redirect } from 'expo-router';
import { useApp } from '../src/store/AppContext';

export default function Index() {
  const { state } = useApp();

  if (!state.isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!state.onboardingComplete) {
    return <Redirect href="/(onboarding)/org-name" />;
  }

  switch (state.role) {
    case 'admin':
      return <Redirect href="/(owner_admin)/overview" />;
    case 'subadmin':
      return <Redirect href="/(subadmin)/overview" />;
    case 'employee':
      return <Redirect href="/(employee)/my-day" />;
    default:
      return <Redirect href="/(auth)/sign-in" />;
  }
}
