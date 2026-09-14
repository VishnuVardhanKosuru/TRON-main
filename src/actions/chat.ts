"use server";

import { askGateway, type ChatMessage } from "@/lib/ai-gateway";
import { searchMemories } from "@/server/memory";

/**
 * TRON's conversational brain. Runs against llama.cpp on the Redmi.
 *
 * The prompt is short on purpose: Qwen3-1.7B holds a compact instruction set far
 * better than a long one, and everything here costs real seconds on phone CPU.
 */
const TRON_SYSTEM_PROMPT = `You are TRON, a private personal assistant running entirely on the owner's own device.

You have two tools:

queryCollection(collection, filters?) — search stored data. Valid collections only:
  todos, reminders, routines, notes, people_notes, travel, wishlist,
  shopping, stock, ledger, goals
  Never query journal, gratitude, vault, moods, health or periods. They are private.

storeCapture(text) — save something new. Pass the owner's exact words.

Routing:
- Owner states a new fact or task -> storeCapture
- Owner asks about existing data -> queryCollection
- A person's name is mentioned in a question -> check people_notes first
- Greeting or small talk -> just reply, no tool

Answering:
- Answer only from tool results. Never invent an entry.
- Nothing found: say so plainly and offer to capture it.
- Short replies. Bullets for lists. Direct and warm.
- You do not remember things automatically. If asked to remember something,
  tell the owner to say: TRON, remember <the thing>`;

const tools = [
  {
    type: "function",
    function: {
      name: "queryCollection",
      description: "Search the owner's local database for existing notes, tasks, or data.",
      parameters: {
        type: "object",
        properties: {
          collection: {
            type: "string",
            description: "Collection name, e.g. todos, travel, reminders, goals.",
          },
          filters: {
            type: "array",
            description: "Optional filters to narrow results.",
            items: {
              type: "object",
              properties: {
                field: { type: "string" },
                operator: { type: "string", enum: ["==", ">", "<", ">=", "<=", "in"] },
                value: { type: "string" },
              },
              required: ["field", "operator", "value"],
            },
          },
        },
        required: ["collection"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "storeCapture",
      description: "Save a new note, task, reminder, or thought into TRON.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The exact raw text the owner wants to capture. Pass it verbatim.",
          },
        },
        required: ["text"],
      },
    },
  },
];

/**
 * Pull in any stored memories relevant to what was just asked.
 *
 * This is retrieval of things the owner explicitly told TRON to remember — it
 * never writes. Storing stays behind the explicit "TRON, remember ..." command.
 */
function memoryContext(messages: ChatMessage[]): string | null {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser?.content) return null;

  const hits = searchMemories(lastUser.content, 6);
  if (hits.length === 0) return null;

  return `Things the owner has explicitly asked you to remember:\n${hits
    .map((m) => `- ${m.content}`)
    .join("\n")}`;
}

export async function askTron(messages: ChatMessage[]): Promise<ChatMessage> {
  const memories = memoryContext(messages);

  const fullMessages: ChatMessage[] = [
    {
      role: "system",
      content: memories
        ? `${TRON_SYSTEM_PROMPT}\n\n${memories}`
        : TRON_SYSTEM_PROMPT,
    },
    ...messages,
  ];

  try {
    return await askGateway(fullMessages, {
      temperature: 0.3,
      tools,
      maxTokens: 800,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[TRON] chat error:", message);
    throw new Error(message);
  }
}
