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
  parentId?: string;  // This could be either commentId or replyId
  commentId: string; // The ID of the original comment
  addReply: (commentId: string, replyText: string, replyId?: string) => void;
  isAuthenticated: boolean;
  onClose: () => void;
}

const ReplyComment: React.FC<ReplyCommentProps> = ({
  addReply,
  parentId,
  commentId,
  onClose,
}) => {
  const quillRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Quill | null>(null);
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
                    const image = editorRef.current?.root.querySelector(`img[src="${fileURL}"]`) as HTMLImageElement;
                    if (image) {
                      image.style.width = '20vw';
                      image.style.height = '20vh';
                      image.style.objectFit = 'contain';
                    }
                  }
                };
              },
              link: () => {
                const url = prompt("Enter the URL");
                const range = editorRef.current?.getSelection();
                if (url && range) {
                  editorRef.current?.formatText(range.index, range.length, "link", url);
                }
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
      const htmlContent = editorRef.current.root.innerHTML;
  
      // Function to get the text length excluding HTML tags
      const getTextLength = (html: string) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        return tempDiv.textContent?.length || 0;
      };
  
      const textLength = getTextLength(htmlContent);
  
      if (textLength > 250) {
        alert("Comment exceeds 250 characters.");
        return;
      }
  console.log(parentId);
  console.log(commentId);
      // Add the reply, taking into account the parentId
      if (commentId&&parentId) {
        addReply(commentId, htmlContent, parentId);
      }
      else{
        addReply(commentId, htmlContent);
      }
     
      // Clear the editor content and close the reply section
      editorRef.current.root.innerHTML = "";
      onClose();
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
