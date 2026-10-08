export interface ConvaiMessageLike {
  id?: string;
  type?: string;
  content?: string;
  timestamp?: string | number | Date;
}

export interface ConvaiStateLike {
  isConnected: boolean;
  isConnecting: boolean;
  isListening: boolean;
  isThinking: boolean;
  isSpeaking: boolean;
  agentState: string;
}
