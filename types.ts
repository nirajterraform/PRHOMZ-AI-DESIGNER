export enum AppMode {
  GENERATE = 'GENERATE',
  REMODEL = 'REMODEL',
  ASSISTANT = 'ASSISTANT',
  GALLERY = 'GALLERY'
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  mode: 'creation' | 'edit';
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
}

export interface ProductItem {
  id: string;
  name: string;
  description: string;
  price: number;
  colors: string[];
}

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
