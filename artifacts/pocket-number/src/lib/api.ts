export function getAuthToken() {
  return localStorage.getItem('pn_token');
}

export function getAuthHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getAuthRequestOptions() {
  return {
    headers: getAuthHeaders(),
  };
}
