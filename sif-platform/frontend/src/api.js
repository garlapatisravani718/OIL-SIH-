import axios from 'axios'
const api = axios.create({baseURL: 'http://localhost:8000/api'})
api.interceptors.request.use(c => { const t = localStorage.getItem('token'); if (t) c.headers.Authorization = 'Bearer ' + t; return c })
export default api
