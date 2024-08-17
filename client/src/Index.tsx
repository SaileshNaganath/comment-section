/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import Auth from "./GAuth";
import CommentInput from "./components/CommentInput";
import Comments from "./components/Comments";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "./firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

const Index: React.FC = () => {
  const [user] = useAuthState(auth);
  const [comments, setComments] = useState<any[]>([]);
  const [sortOption, setSortOption] = useState<"latest" | "popular">("latest");

  const handleSortChange = (option: "latest" | "popular") => {
    setSortOption(option);
  };

  useEffect(() => {
    const commentsQuery = query(
      collection(db, "comments"),
      orderBy(sortOption === "latest" ? "timestamp" : "reactions.👍", "desc"),
      limit(8)
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(commentsQuery, (querySnapshot) => {
      const commentsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setComments(commentsData);
    });

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, [sortOption]);

  return (
    <div className="index">
      <Auth />
      <div>
        <button onClick={() => handleSortChange("latest")}>
          Sort by Latest
        </button>
        <button onClick={() => handleSortChange("popular")}>
          Sort by Popular
        </button>
      </div>
      <CommentInput
        userId={user?.uid || ""}
        userName={user?.displayName || ""}
        userPhoto={user?.photoURL || ""}
        isAuthenticated={!!user} // Check if user is authenticated
      />
      
      <div className="comments-list">
        <Comments
          comments={comments}
          sortOption={sortOption}
          setSortOption={setSortOption}
        />
      </div>
    </div>
  );
};

export default Index;
