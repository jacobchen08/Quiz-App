import './App.css';
import { useState, useMemo } from 'react';

// start localhost 8000 in apicall.py
// cd my-react-app
// npm run dev

//to do list: make the user be able to change the number of questions, difficulty, and category of questions. Make the user be able to select the correct answer and see if they are right or wrong. Make the user be able to see their score at the end of the quiz. Make the user be able to restart the quiz.

function App() {
  const [category, setCategory] = useState([]);
  const [correctAnswer, setAnswer] = useState([]);
  const [difficulty, setDifficulty] = useState([]);
  const [incorrectAnswers, setIncorrect] = useState([]);
  const [questions, setQuestions] = useState([]); // Questions
  const [type, setType] = useState([]); // Question types (multiple or boolean)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0); // New state for score
  const [answeredQuestions, setAnsweredQuestions] = useState([]); // Contains indexes of answered questions

  //randomizes order of answers for multiple choice questions
  const currentOptions = useMemo(() => {
    if (questions.length === 0) return [];

    return type[currentIndex] === 'multiple'
      ? [correctAnswer[currentIndex], ...(incorrectAnswers[currentIndex] || [])]
          .sort(() => Math.random() - 0.5)
      : ['True', 'False'];
  }, [currentIndex, questions]); // Only recalculates when currentIndex or questions change

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

  function handleAnswerSelection(selectedAnswer) {
    if (selectedAnswer === correctAnswer[currentIndex]) {
      setScore((prevScore) => prevScore + 1);
    }
    setAnsweredQuestions((prev) => [...prev, currentIndex]); // Mark the question as answered
  }

  function buttonCall() {
    alert('Button clicked!');

    fetch('http://localhost:8000/questions')
      .then((response) => response.json())
      .then((data) => {
        // Extract decoded question strings
        const questionTexts = data.map((item) => decodeHtml(item.question));
        const categories = data.map((item) => item.category);
        const correctAnswers = data.map((item) => decodeHtml(item.correct_answer));
        const incorrectAnswers = data.map((item) => item.incorrect_answers.map(ans => decodeHtml(ans)));
        const types = data.map((item) => item.type);

        setQuestions(questionTexts);
        setCategory(categories);
        setAnswer(correctAnswers);
        setIncorrect(incorrectAnswers);
        setType(types);
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

          Score: {score} / {questions.length}
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

          {/*If multiple choice, then have 4 buttons */}
          {type[currentIndex] === 'multiple' ? (
            

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
            <button
              onClick={() => handleAnswerSelection(currentOptions[0])}
              disabled = {answeredQuestions.includes(currentIndex)}
            >
              {currentOptions[0]}
              
            </button>

            <button
              onClick={() => handleAnswerSelection(currentOptions[1])}
              disabled = {answeredQuestions.includes(currentIndex)}
            >
              {currentOptions[1]}
              
            </button>

            <button
              onClick={() => handleAnswerSelection(currentOptions[2])}
              disabled = {answeredQuestions.includes(currentIndex)}
            >
              {currentOptions[2]}
              
            </button>

            <button
              onClick={() => handleAnswerSelection(currentOptions[3])}
              disabled = {answeredQuestions.includes(currentIndex)}
            >
              {currentOptions[3]}
              
            </button>
            
        
          </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
              <button>True</button>
              <button>False</button>
            </div>
          )}
        </div>
      ) : (
        <p style={{ marginTop: '20px' }}>Click "Generate Questions" to begin.</p>
      )}
    </div>
  );
}

export default App;