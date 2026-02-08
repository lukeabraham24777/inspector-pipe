import axios from 'axios';

const API_BASE = '/api';

export async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post(`${API_BASE}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return response.data;
}

export async function getResults() {
  const response = await axios.get(`${API_BASE}/results`);
  return response.data;
}

export async function exportXlsx() {
  const response = await axios.get(`${API_BASE}/export`, {
    responseType: 'blob',
  });

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'ILI_Alignment_Results.xlsx');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
