import React from "react";
import { signInWithPopup } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, googleProvider, db } from "./firebase"; // Make sure `db` is imported
import { doc, setDoc, query, where, getDocs, collection } from "firebase/firestore";

const Auth: React.FC = () => {
  const [user, loading, error] = useAuthState(auth);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user exists in Firestore by email
      const usersRef = collection(db, "users");
      const emailQuery = query(usersRef, where("email", "==", user.email));
      const querySnapshot = await getDocs(emailQuery);

      if (!querySnapshot.empty) {
        // If a user with the same email exists, update that document
        const existingUserDoc = querySnapshot.docs[0];
        const userRef = doc(db, "users", existingUserDoc.id);
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          updatedAt: new Date(), // Optionally add updatedAt timestamp
        }, { merge: true });
      } else {
        // Create new user document
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          createdAt: new Date(),
        });
      }

    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading) {
    return <p>Loading...</p>; // Consider adding a spinner here
  }

  return (
    <div>
      {user ? (
        <div>
          <img src={user.photoURL || ""} alt={user.displayName || "User"} style={{ width: "50px", borderRadius: "50%" }} />
          <p>Welcome, {user.displayName}</p>
          <button onClick={handleLogout}>Sign Out</button>
        </div>
      ) : (
        <button onClick={signInWithGoogle}>Sign in with Google</button>
      )}
      {error && <p>Error signing in: {error.message}</p>}
    </div>
  );
};

export default Auth;
