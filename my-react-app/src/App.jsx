import './App.css';
import { useState } from 'react';

// start localhost 8000 in apicall.py
// cd my-react-app
// npm run dev

function App() {
  const [category, setCategory] = useState([]);
  const [correctAnswer, setAnswer] = useState([]);
  const [difficulty, setDifficulty] = useState([]);
  const [incorrectAnswers, setIncorrect] = useState([]);
  const [questions, setQuestions] = useState([]); // Array of strings
  const [type, setType] = useState([]); // Array of strings
  const [currentIndex, setCurrentIndex] = useState(0);

  function nextQuestion() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prevIndex) => prevIndex + 1);
    }
  }

  function previousQuestion() {
    if (currentIndex > 0) {
      setCurrentIndex((curr) => curr - 1);
    }
  }

  function decodeHtml(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  }

  function buttonCall() {
    alert('Button clicked!');

    fetch('http://localhost:8000/questions')
      .then((response) => response.json())
      .then((data) => {
        // Extract decoded question strings
        const questionTexts = data.map((item) => decodeHtml(item.question));
        const categories = data.map((item) => item.category);

        setQuestions(questionTexts);
        setCategory(categories);
        setCurrentIndex(0);
        console.log(data);
      })
      .catch((error) => console.error('Error:', error));
  }

  return (
    <div className="App">
      <h1>Quiz App</h1>

      <button onClick={buttonCall}>Generate Questions</button>

      {questions.length > 0 ? (
        <div style={{ marginTop: '20px' }}>
          <p>
            <strong>Question {currentIndex + 1} of {questions.length}</strong>
            {category[currentIndex] && <span> ({category[currentIndex]})</span>}
          </p>
          <p>{questions[currentIndex]}</p>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
            <button 
              onClick={previousQuestion} 
              disabled={currentIndex === 0}
            >
              Previous
            </button>

            <button 
              onClick={nextQuestion} 
              disabled={currentIndex >= questions.length - 1}
            >
              Next
            </button>
          </div>
        </div>




      ) : (
        <p style={{ marginTop: '20px' }}>Click "Generate Questions" to begin.</p>
      )}
    </div>
  );
}

export default App;