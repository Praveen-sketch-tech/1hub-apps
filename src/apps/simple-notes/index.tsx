import React, { useState } from "react";

export function SimpleNotesPage() {
  const [notes, setNotes] = useState<string[]>([]);
  const [text, setText] = useState("");

  const addNote = () => {
    if (!text.trim()) return;
    setNotes([...notes, text]);
    setText("");
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Simple Notes</h1>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter note"
      />

      <button onClick={addNote}>
        Add
      </button>

      <ul>
        {notes.map((note, i) => (
          <li key={i}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

export default SimpleNotesPage;
