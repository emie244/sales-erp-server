import axios from './axios';

export interface MaterialCategory {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  level: number;
  sortOrder: number;
  isActive: boolean;
  children?: MaterialCategory[];
  createdAt: string;
  updatedAt?: string;
}

export const fetchMaterialCategories = (params?: { keyword?: string }) =>
  axios.get('/material-categories', { params }) as Promise<MaterialCategory[]>;

export const createMaterialCategory = (data: {
  code: string;
  name: string;
  parentId?: string;
  level?: number;
  sortOrder?: number;
}) => axios.post('/material-categories', data) as Promise<MaterialCategory>;

export const updateMaterialCategory = (
  id: string,
  data: Partial<{
    code: string;
    name: string;
    parentId?: string;
    level?: number;
    sortOrder?: number;
  }>,
) => axios.put(`/material-categories/${id}`, data) as Promise<MaterialCategory>;

export const deleteMaterialCategory = (id: string) =>
  axios.delete(`/material-categories/${id}`) as Promise<void>;
