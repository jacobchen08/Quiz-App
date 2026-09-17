import './App.css'
import { useState } from 'react';

//start localhost 8000 in apicall.py
//cd my-react-app
//npm run dev

function App() {
  const[category,setCategory] = useState([]);
  const[correctAnswer,setAnswer] = useState([]);
  const[difficulty,setDifficulty] = useState([]);
  const[incorrectAnswers,setIncorrect] = useState([]);
  const[questions, setQuestions] = useState([]); //Array of strings
  const[type,setType] = useState([]); //Array of strings
  const[currentIndex, setCurrentIndex] = useState(0);

  function nextQuestion() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prevIndex => prevIndex + 1);
    }
  }

  function previousQuestion(){
    if(currentIndex > 0){
      setCurrentIndex(curr => curr - 1)
    }
  }

  function decodeHtml(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  }

  function buttonCall() {
    alert('Button clicked!')
    
    fetch('http://localhost:8000/questions')
    .then(response => response.json())
  //  .then(data => console.log(data))
    .then((data) => {
      // data is an array of objects from OpenTDB
      // Extract just the question text into an array of strings
      const questionTexts = data.map((item) => decodeHtml(item.question))


      const categories = data.map((item) => (item.category))

      setQuestions(questionTexts)
      setCurrentIndex(0)
      console.log(data)
    })
    .catch(error => console.error('Error:', error))
    
  }






  //const [questions, setQuestions] = useState([]);
  return (
    <div className="App">
      <h1>Quiz App</h1>
  
      <button onClick={buttonCall}>Generate Questions</button>
      
     {/*<p>{questions.join(',')}</p>*/}
      
  
      {questions.length > 0 && currentIndex < questions.length ? (
        <div>
          {/* Display current question */}
          <p>Question {currentIndex + 1} of {questions.length}</p>
          <p>{questions[currentIndex]}</p>


        {/* Goes to previous question*/}
          <button 
            onClick={previousQuestion} 
            disabled={currentIndex <= 0}
          >
            Previous Question
          </button>



          {/* Advance button */}
          <button 
            onClick={nextQuestion} 
            disabled={currentIndex >= questions.length - 1}
          >
            Next Question
          </button>


          




        </div>
      ) : (
        <p>No questions loaded yet.</p>
      )}

    </div>
    
    
  )
}

export default App
