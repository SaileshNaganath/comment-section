/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "../firebase";
import { collection, query, orderBy, limit, startAfter, getDocs, doc, updateDoc, arrayUnion, serverTimestamp, getDoc, onSnapshot } from "firebase/firestore";
import moment from "moment";
import Picker from "@emoji-mart/react";
import data from '@emoji-mart/data';
import DOMPurify from "dompurify"; // Import DOMPurify
import ReplyComment from "./ReplyComment";

interface Comment {
  id: string;
  userName: string; 
  userPhoto: string; 
  commentText: string; 
  timestamp: any; 
  reactions: { [emoji: string]: number }; 
  attachments: string[]; 
  replies: Comment[]; 
}

interface CommentsProps {
  comments: any[]; // Change this to match the Comment type
  sortOption: "latest" | "popular";
  setSortOption: (option: "latest" | "popular") => void;
}

const Comments: React.FC<CommentsProps> = ({ sortOption }) => {
  const [user] = useAuthState(auth);
  const [comments, setComments] = useState<Comment[]>([]);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isShowMore, setShowMore] = useState<{ [key: string]: boolean }>({});
  const [emojiPickerVisible, setEmojiPickerVisible] = useState<string | null>(null);

  useEffect(() => {
    const commentsQuery = query(
      collection(db, "comments"),
      orderBy("timestamp", "desc"),
      limit(8)
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(commentsQuery, (querySnapshot) => {
      const commentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setComments(commentsData);
    });

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const q = query(
          collection(db, "comments"),
          orderBy(sortOption === "latest" ? "timestamp" : "reactions.👍", "desc"),
          limit(8)
        );
        const querySnapshot = await getDocs(q);
        const commentsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          replies: doc.data().replies ? doc.data().replies : [],
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
        orderBy(sortOption === "latest" ? "timestamp" : "reactions.👍", "desc"),
        startAfter(lastVisible),
        limit(8)
      );
      const querySnapshot = await getDocs(q);
      const newComments = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Comment[];

      setComments((prev) => [...prev, ...newComments]);
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
    } catch (error) {
      console.error("Error loading more comments:", error);
    }
  };

  const handleShowMoreToggle = (id: string) => {
    setShowMore(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEmojiReaction = async (id: string, emoji: string) => {
    try {
      const commentRef = doc(db, "comments", id);
      const docSnap = await getDoc(commentRef);
  
      if (!docSnap.exists()) {
        console.error("Comment not found");
        return;
      }
  
      const commentData = docSnap.data();
      const currentReactions = commentData?.reactions || {};
  
      const updatedReactions = {
        ...currentReactions,
        [emoji]: (currentReactions[emoji] || 0) + 1,
      };
  
      await updateDoc(commentRef, {
        reactions: updatedReactions,
      });
  
      // Update local state
      setComments((prevComments) =>
        prevComments.map((comment) =>
          comment.id === id
            ? { ...comment, reactions: updatedReactions }
            : comment
        )
      );
      
    } catch (error) {
      console.error(`Error updating reaction for emoji ${emoji}:`, error);
    }
  };

  const handleReplyEmojiReaction = async (commentId: string, replyId: string, emoji: string) => {
    try {
      // Log for debugging
      console.log("commentId:", commentId);
      console.log("replyId:", replyId);
      console.log("emoji:", emoji);
  
      // Reference to the reply document
      const replyRef = doc(db, "comments", commentId, "replies", replyId);
      console.log("replyRef:", replyRef.path);
  
      // Fetch the reply document
      const docSnap = await getDoc(replyRef);
  
      if (!docSnap.exists()) {
        console.error("Reply not found");
        return;
      }
  
      const replyData = docSnap.data();
      const currentReactions = replyData?.reactions || {};
  
      const updatedReactions = {
        ...currentReactions,
        [emoji]: (currentReactions[emoji] || 0) + 1,
      };
  
      // Update the reactions
      await updateDoc(replyRef, {
        reactions: updatedReactions,
      });
  
      // Update the state accordingly
      const updatedComments = comments.map((comment) => {
        if (comment.id === commentId) {
          return {
            ...comment,
            replies: comment.replies.map((reply) => {
              if (reply.id === replyId) {
                return { ...reply, reactions: updatedReactions };
              }
              return reply;
            }),
          };
        }
        return comment;
      });
  
      setComments(updatedComments);
    } catch (error) {
      console.error(`Error updating reaction for emoji ${emoji}:`, error);
    }
  };
  
  const addReply = async (parentId: string, replyText: string) => {
    if (!user) {
      console.error("User is not authenticated");
      return;
    }

    const reply = {
      id: user.uid,
      userName: user.displayName || "",
      userPhoto: user.photoURL || "",
      commentText: replyText,
      reactions: {},
      attachments: [],
      replies: [],
      timestamp: null,
    };

    try {
      const commentRef = doc(db, "comments", parentId);

      // First add the reply to the array
      await updateDoc(commentRef, {
        replies: arrayUnion(reply)
      });
// Now update the timestamp for the specific reply
const updatedReplies = (await getDoc(commentRef)).data()?.replies.map((r: any) => 
  r.id === reply ? { ...r, timestamp: serverTimestamp() } : r
);

// Update the document with the new replies array
await updateDoc(commentRef, {
  replies: updatedReplies,
});

// Update the local state to include the new reply with the timestamp
setComments((prevComments) =>
  prevComments.map((comment) =>
    comment.id === parentId
      ? { ...comment, replies: updatedReplies }
      : comment
  )
);
      // // Update the reply with the server timestamp in a separate operation
      // const replyRef = doc(commentRef, "replies", user.uid); // You may need to adjust this depending on your schema
      // await updateDoc(replyRef, {
      //   timestamp: serverTimestamp(), // Set timestamp
      // });

      // // Update the local state to include the new reply
      // setComments((prevComments) =>
      //   prevComments.map((comment) =>
      //     comment.id === parentId
      //       ? { ...comment, replies: [...comment.replies, { ...reply, timestamp: new Date() }] }
      //       : comment
      //   )
      // );
    } catch (error) {
      console.error("Error adding reply:", error);
    }
  };
  const handleCloseEditor = () => {
    setReplyingTo(null); // Hide the ReplyComment editor
  };
  return (
    <div>
      {comments.map(comment => {
        const showMore = isShowMore[comment.id] || false;
        const truncatedText = comment.commentText.slice(0, 125); // Slice text at 125 characters
        const isTextLong = comment.commentText.length > 125;

        return (
          <div key={comment.id} style={{ marginBottom: "20px" }}>
            <img src={comment.userPhoto} alt={comment.userName} style={{ width: "40px", borderRadius: "50%" }} />
            <p>{comment.userName}</p>
            <div>
              <p
                style={{
                  display: showMore || !isTextLong ? "block" : "-webkit-box",
                  WebkitLineClamp: !showMore && isTextLong ? "1" : "none",
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(showMore ? comment.commentText : truncatedText) }} // Render sanitized HTML
              />
              {isTextLong && (
                <button onClick={() => handleShowMoreToggle(comment.id)}>
                  {showMore ? "Show Less" : "Show More"}
                </button>
              )}
            </div>
            <div>
              {comment.attachments.map((url, index) => (
                <img key={index} src={url} alt="attachment" style={{ width: "50px", height: "50px", objectFit: "cover", marginRight: "5px" }} />
              ))}
            </div>
            <p>{moment(comment.timestamp?.toDate ? comment.timestamp.toDate() : new Date()).fromNow()}</p>
            <div>
  {Object.keys(comment.reactions).length > 0 && (
    <div>
      {Object.keys(comment.reactions).map((emoji) => (
        <span key={emoji} style={{ marginRight: "10px" }}>
          {emoji} {comment.reactions[emoji]}
        </span>
      ))}
    </div>
  )}
  <button onClick={() => setEmojiPickerVisible(comment.id)}>React</button>
  {emojiPickerVisible === comment.id && (
    <div style={{ position: "absolute", zIndex: 1000 }}>
      <Picker
        data={data}
        onEmojiSelect={(emojiObject:any) => {
          handleEmojiReaction(comment.id, emojiObject.native); // Pass native emoji
          setEmojiPickerVisible(null); 
        }}
      />
      
    </div>
  )}
</div>


            {/* Reply Section */}
            <button onClick={() => setReplyingTo(comment.id)}>Reply</button>
            {replyingTo === comment.id && 
            <ReplyComment    
              userId={user?.uid || ""}
              userName={user?.displayName || ""}
              userPhoto={user?.photoURL || ""}
              isAuthenticated={!!user} 
              parentId={comment.id} 
              addReply={addReply}
              onClose={handleCloseEditor} 
            />
            }

            {comment.replies?.length > 0 && (
              <div style={{ marginLeft: "20px" }}>
                {comment.replies.map((reply, replyIndex) => (
                  <div key={`${reply.id}-${replyIndex}`}>
                    <img src={reply.userPhoto} alt={reply.userName} style={{ width: "40px", borderRadius: "50%" }}/>
                    <p>{reply.userName}</p>
                    <p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(reply.commentText) }} /> {/* Render sanitized HTML */}
                    <p>{moment(reply.timestamp?.toDate ? reply.timestamp.toDate() : new Date()).fromNow()}</p>
                    <div>
                      {Object.keys(reply.reactions).length > 0 && (
                        <div>
                          {Object.keys(reply.reactions).map((emoji) => (
                            <span key={emoji} style={{ marginRight: "10px" }}>
                              {emoji} {reply.reactions[emoji]}
                            </span>
                          ))}
                        </div>
                      )}
                      <button onClick={() => setEmojiPickerVisible(reply.id)}>React</button>
                      {emojiPickerVisible === reply.id && (
                        <div style={{ position: "absolute", zIndex: 1000 }}>
                          <Picker
                            data={data}
                            onEmojiSelect={(emojiObject:any) => {
                              handleReplyEmojiReaction(comment.id,reply.id, emojiObject.native); // Pass native emoji
                              setEmojiPickerVisible(null); 
                            }}
                          />
                          
                        </div>
                      )}
                    </div>
                    <button onClick={() => setReplyingTo(comment.id)}>Reply</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <button onClick={loadMore}>Load More</button>
    </div>
  );
};

export default Comments;
