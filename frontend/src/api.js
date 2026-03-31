const BASE = '/api';

const req = async (method, path, body, token) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
};

export const api = {
  get:    (path, token)       => req('GET',    path, null, token),
  post:   (path, body, token) => req('POST',   path, body, token),
  put:    (path, body, token) => req('PUT',    path, body, token),
  delete: (path, token)       => req('DELETE', path, null, token),
};
