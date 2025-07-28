export interface UserData {
  name: string;
  birthDate: string;
  traits: string[];
  about: string;
}

export interface Horoscope {
  introduction: string;
  futureOutlook: string;
  challenges: string;
  advice: string;
  luckyElements: string;
}

// New types for chat
export type MessageSender = 'user' | 'ai';

export interface ChatMessage {
  id: string;
  text: string;
  sender: MessageSender;
}
