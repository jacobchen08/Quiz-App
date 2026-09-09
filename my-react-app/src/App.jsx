import './App.css'



//cd my-react-app
//npm run dev



function buttonCall() {
  alert('Button clicked!')

  
  fetch('http://localhost:8000/questions')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error))
  
}




function App() {
  return (
    <div className="App">
      <h1>Quiz App</h1>
  
      <button onClick={buttonCall}>Generate Questions</button>
  


    </div>
    
    
  )
}

export default App
