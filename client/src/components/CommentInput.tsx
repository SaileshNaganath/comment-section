import React, { useEffect, useRef,useState } from "react";
import "quill/dist/quill.snow.css";
import Quill from "quill";
import "quill-mention/autoregister"; // Import quill mention plugin
import { db, storage } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";


import {Mention, MentionBlot} from "quill-mention";

Quill.register({ "blots/mention": MentionBlot, "modules/mention": Mention });

// Example list of users to mention (you should fetch this from your user database)
const users = [
  { id: "1", value: "John Doe", link: "mailto:johndoe@example.com" },
  { id: "2", value: "Jane Smith", link: "mailto:janesmith@example.com" },
  // Add more users here
];

interface CommentInputProps {
  userId: string;
  userName: string;
  userPhoto: string;
}

const CommentInput: React.FC<CommentInputProps> = ({ userId, userName, userPhoto }) => {
  const quillRef = useRef(null);
  const [editor, setEditor] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (quillRef.current) {
      const quill = new Quill(quillRef.current, {
        theme: "snow",
        modules: {
          toolbar: [
            ["bold", "italic", "underline", "link"],
            ["image"],
          ],
          mention: {
            allowedChars: /^[A-Za-z\s]*$/,
            mentionDenotationChars: ["@"],
            source: function (searchTerm, renderList) {
              const matches = users.filter((user) =>
                user.value.toLowerCase().includes(searchTerm.toLowerCase())
              );
              renderList(matches, searchTerm);
            },
          },
        },
      });

      setEditor(quill);
    }
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const storageRef = ref(storage, `comments/${file.name}`);
      await uploadBytes(storageRef, file);
      const fileURL = await getDownloadURL(storageRef);
      setFile(fileURL);
    }
  };

  const submitComment = async () => {
    if (editor) {
      const commentText = editor.root.innerHTML;
      console.log(commentText);
    
    if (commentText.length > 250) {
      alert("Comment exceeds 250 characters.");
      return;
    }
    await addDoc(collection(db, "comments"), {
      userId,
      userName,
      userPhoto,
      commentText,
      timestamp: serverTimestamp(),
      attachments: file ? [file] : [],
      reactions: { likes: 0, dislikes: 0 },
    });
    setCommentText("");
    setFile(null);
  }
  };

  return (
    <div>
      <input type="file" onChange={handleFileUpload} />
      <div ref={quillRef} style={{ height: "200px" }}></div>
      <button onClick={submitComment}>Post Comment</button>
    </div>
  );
};

export default CommentInput;


