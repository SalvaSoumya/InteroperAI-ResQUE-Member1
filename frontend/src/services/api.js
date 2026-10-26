
import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://interoperai-member1-api.onrender.com/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const uploadDataset = async (file, jobId) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post(
    `/jobs/${jobId}/upload`,
    formData
  );

  return response.data;
};

export const integrateDataset = async (jobId) => {
  const response = await api.post(
    `/jobs/${jobId}/integrate`
  );

  return response.data;
};

export const getJobStatus = async (jobId) => {
  const response = await api.get(`/jobs/${jobId}`);
  return response.data;
};

export default api;
