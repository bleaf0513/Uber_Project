import axios from "axios";
import { getApiBaseUrl } from "../apiBase";

const API_BASE = getApiBaseUrl();

function getCaptainToken() {
  return (
    localStorage.getItem("captainToken") ||
    localStorage.getItem("token") ||
    ""
  );
}

function getAuthHeaders() {
  const token = getCaptainToken();

  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function getMyWallet() {
  const response = await axios.get(`${API_BASE}/wallet/me`, {
    headers: getAuthHeaders(),
  });

  return response.data;
}

export async function createWalletTopup({ amount, method, paymentProofUrl = "" }) {
  const response = await axios.post(
    `${API_BASE}/wallet/topups`,
    {
      amount,
      method,
      paymentProofUrl,
    },
    {
      headers: getAuthHeaders(),
    }
  );

  return response.data;
}

export async function getMyTopups({ status = "", limit = 50 } = {}) {
  const params = new URLSearchParams();

  if (status) {
    params.append("status", status);
  }

  if (limit) {
    params.append("limit", String(limit));
  }

  const queryString = params.toString();
  const url = queryString
    ? `${API_BASE}/wallet/topups?${queryString}`
    : `${API_BASE}/wallet/topups`;

  const response = await axios.get(url, {
    headers: getAuthHeaders(),
  });

  return response.data;
}

export async function getMyWalletMovements({ type = "", limit = 50 } = {}) {
  const params = new URLSearchParams();

  if (type) {
    params.append("type", type);
  }

  if (limit) {
    params.append("limit", String(limit));
  }

  const queryString = params.toString();
  const url = queryString
    ? `${API_BASE}/wallet/movements?${queryString}`
    : `${API_BASE}/wallet/movements`;

  const response = await axios.get(url, {
    headers: getAuthHeaders(),
  });

  return response.data;
}

export function formatCOP(value) {
  const number = Number(value) || 0;

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(number));
}