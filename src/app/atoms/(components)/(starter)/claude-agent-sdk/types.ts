export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export interface StreamChunk {
  type: "text" | "init" | "result" | "error" | "done";
  content?: string;
  sessionId?: string;
  model?: string;
  cost?: number;
  duration?: number;
  error?: string;
}

export interface SendMessageParams {
  prompt: string;
  systemPrompt?: string;
}
