import {
  GoogleAuthProvider,
  getIdTokenResult,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { auth, functions } from "./firebase";

type AdminSession = {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  hasError: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  requestAccess: () => Promise<void>;
  clearError: () => void;
};

const AdminSessionContext = createContext<AdminSession | null>(null);

async function hasAdminClaim(user: User): Promise<boolean> {
  const token = await getIdTokenResult(user);
  return token.claims.admin === true;
}

export function AdminSessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (nextUser) => {
        setIsLoading(true);
        setHasError(false);
        setUser(nextUser);
        try {
          setIsAdmin(nextUser ? await hasAdminClaim(nextUser) : false);
        } catch {
          setIsAdmin(false);
          setHasError(true);
        } finally {
          setIsLoading(false);
        }
      }),
    [],
  );

  const signIn = useCallback(async () => {
    setHasError(false);
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      setUser(result.user);
      setIsAdmin(await hasAdminClaim(result.user));
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setHasError(false);
    await firebaseSignOut(auth);
  }, []);

  const requestAccess = useCallback(async () => {
    if (!auth.currentUser) return;
    setHasError(false);
    setIsLoading(true);
    try {
      const requestAdminAccess = httpsCallable<void, { granted: true }>(
        functions,
        "requestAdminAccess",
      );
      await requestAdminAccess();
      await auth.currentUser.getIdToken(true);
      setIsAdmin(await hasAdminClaim(auth.currentUser));
    } catch {
      setHasError(true);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setHasError(false), []);

  const value = useMemo<AdminSession>(
    () => ({
      user,
      isAdmin,
      isLoading,
      hasError,
      signIn,
      signOut,
      requestAccess,
      clearError,
    }),
    [user, isAdmin, isLoading, hasError, signIn, signOut, requestAccess, clearError],
  );

  return (
    <AdminSessionContext.Provider value={value}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession(): AdminSession {
  const value = useContext(AdminSessionContext);
  if (!value) {
    throw new Error("useAdminSession must be used inside AdminSessionProvider");
  }
  return value;
}
