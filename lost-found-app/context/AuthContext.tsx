import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
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
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  isAdminMode: boolean;
  setIsAdminMode: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  isAdminMode: false,
  setIsAdminMode: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);

  const refreshProfile = async () => {}; // Dummy to satisfy interface since we use real-time sync now

  useEffect(() => {
    let unsubscribeProfile: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        unsubscribeProfile = onSnapshot(
          doc(db, 'users', currentUser.uid), 
          { includeMetadataChanges: true },
          (docSnap) => {
            if (docSnap.exists()) {
               const data = docSnap.data() as Omit<UserProfile, 'uid'>;
               
               // Prevent premature lockout due to cached 'blocked' status
               if (data.status === 'blocked' && docSnap.metadata.fromCache) {
                 console.log("Cached profile says blocked, waiting for server confirmation...");
                 return; 
               }
               
               setProfile({ uid: currentUser.uid, ...data });
               setIsAdminMode(data.role === 'admin');
            } else {
               setProfile(null);
               setIsAdminMode(false);
            }
            setLoading(false);
          }, 
          (error) => {
             console.warn("Network: Could not fetch real-time user profile.", error.message);
             setLoading(false); // Make sure we don't get stuck loading on error
          }
        );
      } else {
        setProfile(null);
        setLoading(false);
        if (unsubscribeProfile) unsubscribeProfile();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, isAdminMode, setIsAdminMode }}>
      {children}
    </AuthContext.Provider>
  );
};
