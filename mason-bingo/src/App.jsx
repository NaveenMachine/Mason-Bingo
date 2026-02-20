import { useState } from 'react'
import './App.css'
import BingoApp from './components/BingoApp'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <BingoApp/>
    </>
  )
}

export default App
