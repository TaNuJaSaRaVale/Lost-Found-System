import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'blocked';
  studentClass?: string;
  phone?: string;
  prn?: string;
  warnings?: number;
  hasPendingWarning?: boolean;
  notificationsEnabled?: boolean;
  expoPushToken?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdminMode: boolean;
  setIsAdminMode: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdminMode: false,
  setIsAdminMode: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const lastRole = useRef<string | null>(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      // Always detach the previous user's listener (account switch / logout)
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;
      setUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        setIsAdminMode(false);
        lastRole.current = null;
        setLoading(false);
        return;
      }

      unsubscribeProfile = onSnapshot(
        doc(db, 'users', currentUser.uid),
        { includeMetadataChanges: true },
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as Omit<UserProfile, 'uid'>;

            // A stale offline cache may still say "blocked"; wait for the server before locking out.
            if (data.status === 'blocked' && docSnap.metadata.fromCache) {
              setLoading(false);
              return;
            }

            setProfile({ uid: currentUser.uid, ...data });
            // Only reset admin mode when the role actually changes, so the user's toggle sticks.
            if (lastRole.current !== data.role) {
              lastRole.current = data.role;
              setIsAdminMode(data.role === 'admin');
            }
          } else if (!docSnap.metadata.fromCache) {
            // Profile doc is created right after sign-up; it may briefly not exist yet.
            setProfile(null);
            setIsAdminMode(false);
          }
          setLoading(false);
        },
        (error) => {
          console.warn('Could not load user profile:', error.message);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile?.();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdminMode, setIsAdminMode }}>
      {children}
    </AuthContext.Provider>
  );
};
