import { IsString, IsOptional } from 'class-validator';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatRequestDto {
  @IsString()
  text: string;

  @IsOptional()
  history?: ChatMessage[];
}
