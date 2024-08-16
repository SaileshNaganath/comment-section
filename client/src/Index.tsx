import React, { useEffect, useState } from "react";
import Auth from "./GAuth";
import CommentInput from "./components/CommentInput";
import Comments from "./components/Comments";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "./firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";

const Index: React.FC = () => {
  const [user] = useAuthState(auth);
  const [comments, setComments] = useState<any[]>([]);

  useEffect(() => {
    const fetchComments = async () => {
      const q = query(collection(db, "comments"), orderBy("timestamp", "desc"), limit(8));
      const querySnapshot = await getDocs(q);
      const commentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setComments(commentsData);
    };

    fetchComments();
  }, []);

  return (
    <div className="index">
      <Auth />
      {user && (
        <>
          <CommentInput userId={user.uid} userName={user.displayName || ""} userPhoto={user.photoURL || ""} />
         
        </>
      )}
       <div className="comments-list">
            {comments.map(comment => (
              <Comments
                key={comment.id}
                userName={comment.userName}
                userPhoto={comment.userPhoto}
                commentText={comment.commentText}
                timestamp={comment.timestamp}
                reactions={comment.reactions}
              />
            ))}
          </div>
    </div>
  );
};

export default Index;
