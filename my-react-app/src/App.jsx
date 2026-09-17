import './App.css'
import { useState } from 'react';

//start localhost 8000 in apicall.py
//cd my-react-app
//npm run dev






function App() {
  function buttonCall() {
    alert('Button clicked!')
    
  
    
    fetch('http://localhost:8000/questions')
    .then(response => response.json())
  //  .then(data => console.log(data))
    .then((data) => {
      // data is an array of objects from OpenTDB
      // Extract just the question text into an array of strings
      const questionTexts = data.map((item) => item.question);
      setQuestions(questionTexts);
      console.log(data)
    })

    
    .catch(error => console.error('Error:', error))
    
  }






  const [questions, setQuestions] = useState([]);
  return (
    <div className="App">
      <h1>Quiz App</h1>
  
      <button onClick={buttonCall}>Generate Questions</button>
      
      <p>{questions.join(',')}</p>
      
  


    </div>
    
    
  )
}

export default App
