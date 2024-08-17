import React, { useEffect, useRef, useState } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import "quill-mention/autoregister";
import { Mention, MentionBlot } from "quill-mention";
import { db, storage } from "../firebase";
import { getDocs, collection } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

Quill.register({ "blots/mention": MentionBlot, "modules/mention": Mention });

interface User {
  id: string;
  value: string;
  link?: string;
  photoURL?: string;
}

interface ReplyCommentProps {
  userId: string;
  userName: string;
  userPhoto: string;
  parentId: string;
  addReply: (parentId: string, replyText: string) => void;
  isAuthenticated: boolean;
  onClose: () => void; // Added onClose prop to handle editor visibility
}

const ReplyComment: React.FC<ReplyCommentProps> = ({
  addReply,
  parentId,
  onClose, // Destructure onClose
}) => {
  const quillRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Quill | null>(null); // Using ref to store the Quill editor instance
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersCollection = collection(db, "users");
        const userDocs = await getDocs(usersCollection);
        const usersList = userDocs.docs.map((doc) => ({
          id: doc.id,
          value: doc.data().displayName || "Anonymous",
          link: `mailto:${doc.data().email}`,
          photoURL: doc.data().photoURL,
        }));
        setUsers(usersList);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    if (!editorRef.current && quillRef.current) {
      editorRef.current = new Quill(quillRef.current, {
        theme: "snow",
        modules: {
          toolbar: {
            container: [
              ["bold", "italic", "underline", "link"],
              ["image"],
            ],
            handlers: {
              image: () => {
                const input = document.createElement("input");
                input.setAttribute("type", "file");
                input.setAttribute("accept", "image/*");
                input.click();

                input.onchange = async () => {
                  const file = input.files?.[0];
                  if (file) {
                    const storageRef = ref(storage, `comments/${file.name}`);
                    await uploadBytes(storageRef, file);
                    const fileURL = await getDownloadURL(storageRef);
                    const range = editorRef.current?.getSelection(true);
                    if (range) {
                      editorRef.current?.insertEmbed(range.index, "image", fileURL);
                    }
                  }
                };
              },
            },
          },
          mention: {
            allowedChars: /^[A-Za-z\s]*$/,
            mentionDenotationChars: ["@"],
            source: function (searchTerm: string, renderList: (list: User[], searchTerm: string) => void) {
              const matches = users.filter((user) =>
                user.value?.toLowerCase().includes(searchTerm.toLowerCase())
              );
              renderList(matches, searchTerm);
            },
          },
        },
      });
    }
  }, [users]);

  const handleSubmit = async () => {
    if (editorRef.current) {
      const text = editorRef.current.root.innerHTML;
      if (text.length > 250) {
        alert("Comment exceeds 250 characters.");
        return;
      }

      addReply(parentId, text);

      // Clear the Quill editor
      editorRef.current.root.innerHTML = "";

      // Close the editor
      onClose(); // Call the onClose function to hide the editor
    }
  };

  return (
    <div>
      <div ref={quillRef} style={{ height: "200px" }}></div>
      <button onClick={handleSubmit}>Reply</button>
    </div>
  );
};

export default ReplyComment;

