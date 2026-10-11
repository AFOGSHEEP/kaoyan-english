import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { mountKaoyanAPI } from './lib/aiapi'
import './index.css'

mountKaoyanAPI()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
