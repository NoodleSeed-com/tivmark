export function useCustomSignOut() {
  const signOut = async () => {
    try {
      const response = await fetch('/api/auth/custom-signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Signout failed');
      }

      // The custom endpoint invalidates the server session without updating
      // NextAuth's client cache. A full navigation clears that stale
      // authenticated state and avoids the /auth/login -> / redirect loop.
      window.location.replace('/?tab=login');
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  };

  return signOut;
}
