/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "../firebase";
import { collection, query, orderBy, limit, startAfter, getDocs, doc,addDoc, updateDoc, serverTimestamp, getDoc, onSnapshot } from "firebase/firestore";
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
  const [showReplies, setShowReplies] = useState<{ [key: string]: boolean }>({});

  // Recursive function to fetch replies for a comment
  const fetchReplies = useCallback(async (commentId: string): Promise<Comment[]> => {
    const repliesQuery = query(
      collection(db, `comments/${commentId}/replies`),
      orderBy("timestamp", "desc")
    );
    const repliesSnapshot = await getDocs(repliesQuery);
    
    return Promise.all(repliesSnapshot.docs.map(async replyDoc => {
      const replyData = replyDoc.data();
      return {
        id: replyDoc.id,
        ...replyData,
        timestamp: replyData.timestamp.toDate(),
        replies: await fetchReplies(replyDoc.id), // Recursively fetch replies
      } as Comment;
    }));
  },[]);

  useEffect(() => {
    const commentsQuery = query(
      collection(db, "comments"),
      orderBy("timestamp", "desc"),
      limit(8)
    );

    // Function to handle real-time updates
    const handleSnapshot = async (querySnapshot) => {
      const commentsData = await Promise.all(querySnapshot.docs.map(async (doc) => {
        const commentData = doc.data();
        return {
          id: doc.id,
          ...commentData,
          timestamp: commentData.timestamp.toDate(),
          replies: await fetchReplies(doc.id), // Recursively fetch replies
        } as Comment;
      }));
      setComments(commentsData);
    };

    // Set up real-time listener
    const unsubscribe = onSnapshot(commentsQuery, handleSnapshot);

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, [fetchReplies]);

// useEffect(() => {
//     const commentsQuery = query(
//       collection(db, "comments"),
//       orderBy("timestamp"),
//       limit(8)
//     );

//     // Set up real-time listener
//     const unsubscribe = onSnapshot(commentsQuery, (querySnapshot) => {
//       const commentsData = querySnapshot.docs.map((doc) => ({
//         id: doc.id,
//         ...doc.data(),
//       }));
//       setComments(commentsData);
//     });

//     // Cleanup listener on component unmount
//     return () => unsubscribe();
//   }, []);


  useEffect(() => {
    const fetchComments = async () => {
      try {
        const q = query(
          collection(db, "comments"),
          orderBy(sortOption === "latest" ? "timestamp" : "reactions.👍"),
          limit(8)
        );
        const querySnapshot = await getDocs(q);
        const commentsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          replies: doc.data().replies || [],
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
  const handleShowMore = (commentId: string) => {
    setShowReplies(prev => ({ ...prev, [commentId]: !prev[commentId] }));
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
    console.log("Comment ID:", commentId, "Reply ID:", replyId);
    try {
      const replyRef = doc(db, "comments", commentId, "replies", replyId);
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
  
      await updateDoc(replyRef, { reactions: updatedReactions });
  
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
  
  
  const addReply = async (commentId: string, replyText: string, parentId?: string) => {
    if (!user) {
      console.error("User is not authenticated");
      return;
    }
  
    try {
      let docRef;
  
      if (parentId) {
         // If replying to a reply, add to the replies collection of that reply
         docRef = collection(db, "comments", commentId, "replies", parentId, "replies");
      } else {
         // If replying to a comment, add to the replies collection of that comment
         docRef = collection(db, "comments", commentId, "replies");         
      }
  
      // Generate a unique ID for the reply
      const replyDocRef = doc(docRef);
      const id = replyDocRef.id;
  
      const newReply =  {
        id: id,
        userName: user.displayName || "",
        userPhoto: user.photoURL || "",
        commentText: replyText,
        reactions: {},
        attachments: [],
        replies: [],
        timestamp: serverTimestamp(),
      };
  
      console.log("Reply added successfully with ID:", newReply.id);
      await addDoc(docRef, newReply);
        // Update the local state
    setComments(prevComments =>
        prevComments.map(comment => {
          if (comment.id === commentId) {
            if (!parentId) {
              // Add reply directly to the comment
              return {
                ...comment,
                replies: [...(comment.replies || []), newReply],
              };
            } else {
              // Find the parent reply and add the new reply
              return {
                ...comment,
                replies: updateNestedReplies(comment.replies || [], parentId, newReply),
              };
            }
          }
          return comment;
        })
      );
    } catch (error) {
      console.error("Error adding reply:", error);
    }
  };
  
  // Recursive function to update nested replies
  const updateNestedReplies = (replies: Comment[], parentId: string, newReply: Comment): Comment[] => {
    return replies.map(reply => {
      if (reply.id === parentId) {
        return {
          ...reply,
          replies: [...(reply.replies || []), newReply],
        };
      }
      return {
        ...reply,
        replies: updateNestedReplies(reply.replies || [], parentId, newReply),
      };
    });
  };

  const renderReplies = (replies: Comment[]= [], parentCommentId: string) => {
  
    return replies.map((reply: Comment) =>{
        const showMore = isShowMore[reply.id] || false;
        const truncatedText = reply.commentText.slice(0, 125);
        const isTextLong = reply.commentText.length > 125;
        return(
            <div key={reply.id} style={{ marginLeft: "20px" }}>
              <img src={reply.userPhoto} alt={reply.userName} style={{ width: "40px", borderRadius: "50%" }} />
              <p>{reply.userName}</p>
              <div>
              <p
                style={{
                  display: showMore || !isTextLong ? "block" : "-webkit-box",
                  WebkitLineClamp: !showMore && isTextLong ? "1" : "none",
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(showMore ? reply.commentText : truncatedText) }}
              />
              {isTextLong && (
                <button onClick={() => handleShowMoreToggle(reply.id)}>
                  {showMore ? "Show Less" : "Show More"}
                </button>
              )}
            </div>
            <div>
        {reply.attachments.map((url, idx) => (
          <img key={`${url}-${idx}`} src={url} alt="attachment" style={{ width: "50px", height: "50px", objectFit: "cover", marginRight: "5px" }} />
        ))}
      </div>
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
                      onEmojiSelect={(emojiObject: any) => {
                        handleReplyEmojiReaction(parentCommentId,reply.id, emojiObject.native); // Pass native emoji
                        setEmojiPickerVisible(null);
                      }}
                    />
                  </div>
                )}
              </div>
             
              <button onClick={() => setReplyingTo(reply.id)}>Reply</button>
              {replyingTo === reply.id && (
                <ReplyComment
                  userId={user?.uid || ""}
                  userName={user?.displayName || ""}
                  userPhoto={user?.photoURL || ""}
                  isAuthenticated={!!user}
                  commentId={parentCommentId}  // Pass the parent comment's ID for top-level reference
                  parentId={reply.id}          // Pass the current reply's ID as the parentId for the nested reply
                  addReply={addReply}
                  onClose={() => setReplyingTo(null)}
                />
              )}
        
              {/* Recursive call to render nested replies */}
              {reply.replies.length > 0 && (
          <div>
            <button onClick={() => handleShowMore(reply.id)}>
              {showReplies[reply.id] ? 'Show Less' : 'Show More'}
            </button>
            {showReplies[reply.id] && renderReplies(reply.replies,parentCommentId)}
          </div>
        )}
            </div>
          )
    });
  };
  
  


  return (
    <div>
      {comments.map((comment, index) => {
  const showMore = isShowMore[comment.id] || false;
  const truncatedText = comment.commentText.slice(0, 125);
  const isTextLong = comment.commentText.length > 125;

  return (
    <div key={`${comment.id}-${index}`} style={{ marginBottom: "20px" }}>
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
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(showMore ? comment.commentText : truncatedText) }}
        />
        {isTextLong && (
          <button onClick={() => handleShowMoreToggle(comment.id)}>
            {showMore ? "Show Less" : "Show More"}
          </button>
        )}
      </div>
      <div>
        {comment.attachments.map((url, idx) => (
          <img key={`${url}-${idx}`} src={url} alt="attachment" style={{ width: "50px", height: "50px", objectFit: "cover", marginRight: "5px" }} />
        ))}
      </div>
      <p>{moment(comment.timestamp?.toDate ? comment.timestamp.toDate() : new Date()).fromNow()}</p>
      <div>
        {Object.keys(comment.reactions).length > 0 && (
          <div>
            {Object.keys(comment.reactions).map((emoji) => (
              <span key={`${emoji}-${comment.id}`} style={{ marginRight: "10px" }}>
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
              onEmojiSelect={(emojiObject) => {
                handleEmojiReaction(comment.id, emojiObject.native);
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
          commentId={comment.id} 
          addReply={addReply}
          onClose={() => setReplyingTo(null)} 
        />
      }

      {comment.replies.length > 0 && 
      (
        <div>
          <button onClick={() => handleShowMore(comment.id)}>
            {showReplies[comment.id] ? 'Show Less' : 'Show More'}
          </button>
          {showReplies[comment.id] && renderReplies(comment.replies, comment.id)}
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
