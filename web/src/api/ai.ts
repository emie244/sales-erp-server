import axios from './axios';

export interface OrderDraftItem {
  productId: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  qty: number;
  unitPrice: number;
  lineAmount: number;
}

export interface OrderDraft {
  customerId: string;
  customerName: string;
  type: 'sales' | 'overseas';
  items: OrderDraftItem[];
  deliveryDate: string | null;
  payAmount: number;
  totalAmount: number;
  remark: string | null;
}

export interface ParseOrderResponse {
  draft: OrderDraft | null;
  warnings: string[];
  missingFields: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface TopSku {
  skuId: string;
  skuName: string;
  skuCode: string;
  productId: string;
  totalQty: number;
  orderCount: number;
  avgPrice: number;
  lastOrderDate: string;
  stockQty: number;
}

export interface RecommendationResponse {
  creditStatus: {
    creditLimit: number;
    usedCredit: number;
    isBlocked: boolean;
  };
  topSkus: TopSku[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  intent: string;
  message: string;
  action?: {
    type: string;
    target?: string;
    state?: Record<string, any>;
  };
  data?: any;
  suggestions?: string[];
}

export const parseOrderByAI = (text: string) =>
  axios.post('/ai/parse-order', { text }) as Promise<ParseOrderResponse>;

export const fetchCustomerRecommendations = (customerId: string) =>
  axios.get(`/ai/recommendations/${customerId}`) as Promise<RecommendationResponse>;

export const chatWithAI = (text: string, history?: ChatMessage[]) =>
  axios.post('/ai/chat', { text, history }) as Promise<ChatResponse>;
