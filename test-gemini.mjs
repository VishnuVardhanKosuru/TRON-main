const key = process.env.GEMINI_API_KEY;
const model = "gemini-3.5-flash-lite";

const body = {
  contents: [
    { role: "user", parts: [{ text: "Flight to Japan booked next month 10th to 20th" }] }
  ],
  tools: [{
    functionDeclarations: [
      {
        name: "storeCapture",
        description: "Save a new note, task, reminder, or thought into the user's second brain.",
        parameters: {
          type: "object",
          properties: {
            text: { type: "string", description: "The exact raw text the user wants to capture." }
          },
          required: ["text"]
        }
      },
      {
        name: "queryCollection",
        description: "Search the user's personal database for existing notes, tasks, or data.",
        parameters: {
          type: "object",
          properties: {
            collection: { type: "string" }
          },
          required: ["collection"]
        }
      }
    ]
  }],
  toolConfig: { functionCallingConfig: { mode: "AUTO" } },
  generationConfig: { temperature: 0.3 },
  systemInstruction: { parts: [{ text: "You are Lily, a personal assistant. When the user gives you something to remember, call storeCapture. When they ask a question, call queryCollection." }] }
};

fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
})
.then(r => r.json())
.then(d => {
  console.log("STATUS OK");
  console.log(JSON.stringify(d, null, 2));
})
.catch(e => console.error("FETCH ERROR:", e));
