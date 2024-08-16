import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, orderBy, limit, startAfter, getDocs } from "firebase/firestore";
import moment from "moment";

interface Comment {
  id: string;
  userName: string;
  userPhoto: string;
  commentText: string;
  timestamp: any;
  reactions: { likes: number; dislikes: number };
  attachments: string[];
}

const Comments: React.FC = () => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [sortOption, setSortOption] = useState<"latest" | "popular">("latest");

  useEffect(() => {
     async function fetchComments(){
      try {
        const q = query(
          collection(db, "comments"),
          orderBy(sortOption === "latest" ? "timestamp" : "reactions.likes", "desc"),
          limit(8)
        );
        const querySnapshot = await getDocs(q);
        const commentsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Comment[];
        setComments(commentsData);
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      } catch (error) {
        console.error("Error fetching comments:", error);
      }
    };
    fetchComments();
  }, [sortOption]);



  const loadMore = async () => {
    try {
      if (!lastVisible) return;

      const q = query(
        collection(db, "comments"),
        orderBy(sortOption === "latest" ? "timestamp" : "reactions.likes", "desc"),
        startAfter(lastVisible),
        limit(8)
      );
      const querySnapshot = await getDocs(q);
      const commentsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Comment[];
      setComments((prev) => [...prev, ...commentsData]);
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
    } catch (error) {
      console.error("Error loading more comments:", error);
    }
  };

  return (
    <div>
      <div>
        <button onClick={() => setSortOption("latest")}>Sort by Latest</button>
        <button onClick={() => setSortOption("popular")}>Sort by Popular</button>
      </div>
      {comments.map((comment) => (
        <div key={comment.id}>
          <img src={comment.userPhoto} alt={comment.userName} />
          <p>{comment.userName}</p>
          <p>{comment.commentText}</p>
          {comment.attachments.map((url, index) => (
            <img key={index} src={url} alt="attachment" />
          ))}
          <p>{moment(comment.timestamp?.toDate()).fromNow()}</p>
          <p>Likes: {comment.reactions.likes}</p>
        </div>
      ))}
      <button onClick={loadMore}>Load More</button>
    </div>
  );
};

export default Comments;
