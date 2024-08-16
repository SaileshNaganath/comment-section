import React from "react";
import { useSignInWithGoogle } from "react-firebase-hooks/auth";
import { auth } from "./firebase";

const Auth: React.FC = () => {
  const [signInWithGoogle, user, loading, error] = useSignInWithGoogle(auth);

  return (
    <div>
      {loading ? (
        <p>Loading...</p>
      ) : user ? (
        <div>
          <img src={user.user.photoURL || ""} alt={user.user.displayName || "User"} />
          <p>Welcome, {user.user.displayName}</p>
          <button onClick={() => auth.signOut()}>Sign Out</button>
        </div>
      ) : (
        <button onClick={() => signInWithGoogle()}>Sign in with Google</button>
      )}
      {error && <p>Error signing in: {error.message}</p>}
    </div>
  );
};

export default Auth;
